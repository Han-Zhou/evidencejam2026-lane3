// Q1 prototype, rank 1: the expanded graph view. app.js loads this file on the
// first click on "Expand". It is a full-screen canvas in a note-graph style:
// round nodes, straight links, a light force layout, pan and zoom, node
// dragging and node search. It reads the nodes and edges from the panel's own
// SVG, so it shows the same items with the same directions, grades and counts.
// Selection, filters, the status line and the drawer are shared with the panel.
// Vanilla JS, no external requests.
(function () {
'use strict';
var Q = window.Q1, doc = document, root = doc.documentElement, NS = 'http://www.w3.org/2000/svg';
var still = matchMedia('(prefers-reduced-motion: reduce)');
var CW = 46, CH = 18, GW = 76, KMIN = 0.2, KMAX = 5;
var REP = 4000, LANE = 0.12, MID = 0.15, XS = 3, DECAY = 0.0228;
var DORD = ['increase', 'decrease', 'mixed', 'no_effect', 'unclear'];
var SHAPE = {planting_stock: ['●', 'planting stock'], site_treatment: ['■', 'site treatment'], combination: ['◌', 'combination (thin dotted lines join its members)'],
  condition: ['○', 'condition'], outcome: ['◉', 'outcome'], factor: ['●', 'factor']};

function $(s, e) { return (e || doc).querySelector(s); }
function $$(s, e) { return Array.prototype.slice.call((e || doc).querySelectorAll(s)); }
function sv(tag, at, par, txt) {
  var e = doc.createElementNS(NS, tag);
  Object.keys(at || {}).forEach(function (k) { e.setAttribute(k, at[k]); });
  if (txt != null) e.textContent = txt;
  if (par) par.appendChild(e);
  return e;
}
function h(tag, cls, par, txt) {
  var e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  if (par) par.appendChild(e);
  return e;
}
function btn(cls, par, txt, label) {
  var b = h('button', cls, par, txt);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  return b;
}
function r1(v) { return Math.round(v * 10) / 10; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lines(s) {
  var out = [], cur = '';
  s.split(' ').forEach(function (w) {
    if (cur && (cur + ' ' + w).length > 22) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  });
  if (cur) out.push(cur);
  return out;
}

// ---------- model: read the panel's SVG ----------
function model(p) {
  var N = [], by = {}, E = [], byRef = {}, M = [], L = [], sx = 0, sy = 0;
  $$('.nd', p.svg).forEach(function (g) {
    var m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute('transform')), b = $('.bx', g), id = Q.refOf(g).slice(5);
    var n = {id: id, ref: 'node:' + id, label: g.getAttribute('data-label'), aria: g.getAttribute('aria-label'),
      kind: g.getAttribute('data-kind') || (g.classList.contains('k-outcome') ? 'outcome' : 'factor'),
      x: +m[1] + b.width.baseVal.value / 2, y: +m[2] + b.height.baseVal.value / 2, vx: 0, vy: 0, deg: 0, fx: null, fy: null};
    sx += n.x; sy += n.y;
    N.push(n); by[id] = n;
  });
  // Start from the panel layout, centred and spread wide, and keep each node near its lane.
  N.forEach(function (n) { n.x = (n.x - sx / N.length) * XS; n.y -= sy / N.length; n.lx = n.x; });
  $$('.ln', p.svg).forEach(function (g) {
    var ref = Q.refOf(g), a = p.attr[ref] || {}, s = by[g.getAttribute('data-s')], t = by[g.getAttribute('data-t')] || null;
    var chip = (p.refs[ref] || []).filter(function (x) { return x.closest('svg') === p.svg && x.hasAttribute('tabindex'); })[0];
    var e = {ref: ref, s: s, t: t, te: g.getAttribute('data-te'), gap: !!a.gap, dir: a.dir, cert: a.cert,
      sw: +$('.p', g).getAttribute('stroke-width') || 1.5, aria: chip ? chip.getAttribute('aria-label') : ref, u: 0.5};
    s.deg++;
    if (t) { t.deg++; L.push({a: s, b: t, len: e.gap ? 280 : 240, str: 0.15}); }
    E.push(e); byRef[ref] = e;
  });
  E.forEach(function (e) { if (e.te) e.T = byRef[e.te]; });
  $$('.mem', p.svg).forEach(function (g) {
    var m = {m: by[g.getAttribute('data-m')], c: by[g.getAttribute('data-c')]};
    M.push(m); L.push({a: m.m, b: m.c, len: 120, str: 0.3});
  });
  N.forEach(function (n) { n.r = 7 + 2.2 * Math.sqrt(n.deg); });
  return {N: N, E: E, M: M, L: L};
}

// ---------- force layout (deterministic: same start, same steps) ----------
function tick(X) {
  var N = X.N, a = X.alpha, i, j, A, B, dx, dy, l, w;
  for (i = 0; i < N.length; i++) for (j = i + 1; j < N.length; j++) {
    A = N[i]; B = N[j]; dx = B.x - A.x; dy = B.y - A.y; l = dx * dx + dy * dy;
    if (l < 1) { dx = j - i; dy = 1; l = dx * dx + 1; }
    w = REP * a / l;
    A.vx -= dx * w; A.vy -= dy * w; B.vx += dx * w; B.vy += dy * w;
  }
  X.L.forEach(function (k) {
    A = k.a; B = k.b; dx = B.x - A.x; dy = B.y - A.y; l = Math.sqrt(dx * dx + dy * dy) || 1;
    w = (l - k.len) / l * a * k.str / 2;
    A.vx += dx * w; A.vy += dy * w; B.vx -= dx * w; B.vy -= dy * w;
  });
  N.forEach(function (n) {
    n.vx += (n.lx - n.x) * LANE * a; n.vy -= n.y * MID * a;
    if (n.fx != null) { n.x = n.fx; n.y = n.fy; n.vx = n.vy = 0; return; }
    n.vx *= 0.6; n.vy *= 0.6; n.x += n.vx; n.y += n.vy;
  });
  X.alpha += (X.target - X.alpha) * DECAY;
}
function run(X) {
  if (X.raf) return;
  X.raf = requestAnimationFrame(function step() {
    tick(X); draw(X);
    X.raf = X.alpha > 0.004 || X.target ? requestAnimationFrame(step) : 0;
  });
}

// ---------- drawing ----------
function render(X) {
  var vp = X.vp = sv('g', {'class': 'vp'}, X.svg);
  var gl = sv('g', {}, vp), gn = sv('g', {}, vp), gc = sv('g', {}, vp), gd = sv('g', {}, vp);
  X.M.forEach(function (m) { m.el = sv('line', {'class': 'xm', 'data-m': m.m.id, 'data-c': m.c.id}, gl); });
  X.E.forEach(function (e) {
    var d = e.gap ? ' gap' : ' d-' + e.dir + (e.te ? ' mod' : '');
    e.g = sv('g', {'class': 'xe' + d, 'data-ref': e.ref}, gl);
    e.hit = sv('line', {'class': 'hit'}, e.g);
    e.ln = sv('line', {'class': 'p', 'stroke-width': e.sw}, e.g);
    if (!e.gap && !e.te) e.ah = sv('path', {'class': 'ah'}, e.g);
    if (e.te) e.dia = sv('path', {'class': 'dia d-' + e.dir, 'data-ref': e.ref}, gd);
    e.c = sv('g', {'class': 'xch' + d, 'data-ref': e.ref, tabindex: 0, role: 'button', 'aria-label': e.aria}, gc);
    e.ci = sv('g', {}, e.c);
    if (e.gap) {
      sv('rect', {'class': 'r', x: -GW / 2, y: -CH / 2, width: GW, height: CH, rx: CH / 2}, e.ci);
      sv('text', {y: 3.8}, e.ci, 'No evidence');
    } else {
      sv('rect', {'class': 'r', x: -CW / 2, y: -CH / 2, width: CW, height: CH, rx: CH / 2}, e.ci);
      sv('text', {x: -12, y: 4.6}, e.ci, Q.DIR[e.dir][0]);
      for (var i = 0, n = Q.CERT[e.cert][0]; i < 4; i++) sv('circle', {'class': i < n ? 'f' : 'o', cx: r1(-1.5 + 6 * i), r: 2.3}, e.ci);
    }
  });
  X.N.forEach(function (n) {
    var g = n.g = sv('g', {'class': 'xnd k-' + n.kind, 'data-ref': n.ref, tabindex: 0, role: 'button', 'aria-label': n.aria}, gn);
    if (n.kind === 'outcome') sv('circle', {'class': 'ring', r: r1(n.r + 4)}, g);
    if (n.kind === 'site_treatment') sv('rect', {'class': 'sh', x: r1(-n.r), y: r1(-n.r), width: r1(2 * n.r), height: r1(2 * n.r), rx: 3}, g);
    else sv('circle', {'class': 'sh', r: r1(n.r)}, g);
    n.lw = sv('g', {}, g);
    var t = sv('text', {'class': 'xlab', y: 11}, n.lw);
    var ls = lines(n.label);
    ls.forEach(function (s, i) { sv('tspan', i ? {x: 0, dy: 13} : {x: 0}, t, s); });
    // Rough label box (12 px sans), used to keep chips off the label.
    n.lwid = Math.max.apply(null, ls.map(function (s) { return s.length; })) * 6.6; n.lh = ls.length * 13 + 3;
  });
}
function seg(l, x1, y1, x2, y2) {
  l.setAttribute('x1', r1(x1)); l.setAttribute('y1', r1(y1)); l.setAttribute('x2', r1(x2)); l.setAttribute('y2', r1(y2));
}
function place(e) { e.cx = e.x1 + (e.x2 - e.x1) * e.u; e.cy = e.y1 + (e.y2 - e.y1) * e.u; }
// Move chip e along its own line, away from the point (x, y).
function slide(e, x, y) {
  var near = Math.hypot(x - e.x1, y - e.y1) < Math.hypot(x - e.x2, y - e.y2);
  e.u = clamp(e.u + (near ? 0.07 : -0.07), 0.15, 0.85);
  place(e);
}
function unclutter(C, NB, s, movable) {
  for (var pass = 0, moved = true; pass < 6 && moved; pass++) {
    moved = false;
    C.forEach(function (e) {
      if (!movable(e)) return;
      var hw = (e.gap ? GW : CW) / 2 * s, hh = CH / 2 * s;
      NB.forEach(function (b) {
        if (e.cx + hw < b.x0 || e.cx - hw > b.x1 || e.cy + hh < b.y0 || e.cy - hh > b.y1) return;
        slide(e, b.n.x, b.n.y); moved = true;
      });
    });
    for (var i = 0; i < C.length; i++) for (var j = i + 1; j < C.length; j++) {
      var A = C[i], B = C[j], w = ((A.gap ? GW : CW) + (B.gap ? GW : CW)) / 2 * s + 3;
      if (Math.abs(A.cx - B.cx) >= w || Math.abs(A.cy - B.cy) >= CH * s + 3) continue;
      var ax = A.cx, ay = A.cy;
      if (movable(A)) { slide(A, B.cx, B.cy); moved = true; }
      if (movable(B)) { slide(B, ax, ay); moved = true; }
    }
  }
}
function draw(X) {
  var s = X.cs, C = [];
  X.N.forEach(function (n) {
    n.g.setAttribute('transform', 'translate(' + r1(n.x) + ' ' + r1(n.y) + ')');
    n.lw.setAttribute('transform', 'translate(0 ' + r1(n.r + (n.kind === 'outcome' ? 9 : 5)) + ') scale(' + s + ')');
  });
  X.E.forEach(function (e) {
    if (!e.t) return;
    var a = e.s, b = e.t, dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / d, uy = dy / d;
    var rb = b.r + (b.kind === 'outcome' ? 6 : 3);
    e.x1 = a.x + ux * (a.r + 3); e.y1 = a.y + uy * (a.r + 3); e.x2 = b.x - ux * rb; e.y2 = b.y - uy * rb;
    var al = e.gap ? 0 : 9, ah = Math.max(4, e.sw / 2 + 2.5);
    seg(e.ln, e.x1, e.y1, e.x2 - ux * al, e.y2 - uy * al);
    seg(e.hit, e.x1, e.y1, e.x2, e.y2);
    if (e.ah) e.ah.setAttribute('d', 'M' + r1(e.x2) + ' ' + r1(e.y2) + 'L' + r1(e.x2 - ux * al - uy * ah) + ' ' + r1(e.y2 - uy * al + ux * ah) +
      'L' + r1(e.x2 - ux * al + uy * ah) + ' ' + r1(e.y2 - uy * al - ux * ah) + 'Z');
    e.u = 0.5; place(e); C.push(e);
  });
  // Chips must not cover nodes, labels or each other: slide them along their own lines.
  var NB = X.N.map(function (n) {
    var w = Math.max(n.r + 2, n.lwid * s / 2 + 2), dn = n.r + (n.kind === 'outcome' ? 9 : 5);
    return {n: n, x0: n.x - w, x1: n.x + w, y0: n.y - n.r - 4, y1: n.y + dn + n.lh * s};
  });
  unclutter(C, NB, s, function () { return true; });
  // Moderation: a dotted line from the source to the border of the target edge's chip, ending in a diamond.
  var mods = X.E.filter(function (e) { return e.T; });
  mods.forEach(function (e) {
    var a = e.s, T = e.T, dx = T.cx - a.x, dy = T.cy - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    e.x1 = a.x + dx / d * (a.r + 3); e.y1 = a.y + dy / d * (a.r + 3);
    var hw = (T.gap ? GW : CW) / 2 * s + 2, hh = CH / 2 * s + 2, ex = T.cx - e.x1, ey = T.cy - e.y1;
    var f = Math.min(ex ? hw / Math.abs(ex) : 1e9, ey ? hh / Math.abs(ey) : 1e9);
    e.x2 = T.cx - ex * f; e.y2 = T.cy - ey * f;
    seg(e.ln, e.x1, e.y1, e.x2, e.y2); seg(e.hit, e.x1, e.y1, e.x2, e.y2);
    e.dia.setAttribute('d', 'M' + r1(e.x2) + ' ' + r1(e.y2 - 6) + 'l6 6l-6 6l-6-6z');
    e.u = 0.5; place(e);
  });
  // Only the moderation chips move now: the other chips are where their diamonds point.
  if (mods.length) unclutter(C.concat(mods), NB, s, function (e) { return !!e.T; });
  X.E.forEach(function (e) {
    e.c.setAttribute('transform', 'translate(' + r1(e.cx) + ' ' + r1(e.cy) + ')');
    e.ci.setAttribute('transform', 'scale(' + s + ')');
  });
  X.M.forEach(function (m) {
    var a = m.m, b = m.c, dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    seg(m.el, a.x + dx / d * (a.r + 3), a.y + dy / d * (a.r + 3), b.x - dx / d * (b.r + 3), b.y - dy / d * (b.r + 3));
  });
}

// ---------- pan and zoom ----------
function setView(X, k, tx, ty) {
  X.k = k; X.tx = tx; X.ty = ty;
  X.vp.setAttribute('transform', 'translate(' + r1(tx) + ' ' + r1(ty) + ') scale(' + Math.round(k * 1000) / 1000 + ')');
  X.zl.textContent = Math.round(k * 100) + '%';
  // Labels and chips keep a readable size when zoomed out.
  var s = Math.round(clamp(0.85 / k, 1, 2.6) * 100) / 100;
  if (s !== X.cs) { X.cs = s; draw(X); }
}
function view(X, k, tx, ty, anim) {
  cancelAnimationFrame(X.va);
  clearTimeout(X.vt);
  if (!anim || still.matches) { setView(X, k, tx, ty); return; }
  var k0 = X.k, x0 = X.tx, y0 = X.ty, t0 = performance.now();
  X.va = requestAnimationFrame(function step(now) {
    var t = clamp((now - t0) / 260, 0, 1), e = 1 - Math.pow(1 - t, 3);
    setView(X, k0 + (k - k0) * e, x0 + (tx - x0) * e, y0 + (ty - y0) * e);
    if (t < 1) X.va = requestAnimationFrame(step);
  });
  // If frames stall (a background tab), still end at the target view.
  X.vt = setTimeout(function () { cancelAnimationFrame(X.va); setView(X, k, tx, ty); }, 320);
}
function zoomAt(X, f, mx, my, anim) {
  var k = clamp(X.k * f, KMIN, KMAX);
  f = k / X.k;
  view(X, k, mx - (mx - X.tx) * f, my - (my - X.ty) * f, anim);
}
function size(X) { return [X.svg.clientWidth, X.svg.clientHeight]; }
function fit(X, anim) {
  var S = size(X), a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  if (!S[0] || !S[1]) return;
  X.N.forEach(function (n) {
    a = Math.min(a, n.x - n.r - 70); c = Math.max(c, n.x + n.r + 70);
    b = Math.min(b, n.y - n.r - 12); d = Math.max(d, n.y + n.r + 46);
  });
  var k = clamp(Math.min((S[0] - 40) / (c - a), (S[1] - 40) / (d - b)), KMIN, 1.6);
  view(X, k, S[0] / 2 - (a + c) / 2 * k, S[1] / 2 - (b + d) / 2 * k, anim);
}
function world(X, e) {
  var r = X.svg.getBoundingClientRect();
  return {x: (e.clientX - r.left - X.tx) / X.k, y: (e.clientY - r.top - X.ty) / X.k};
}

// ---------- selection and search ----------
function choose(X, t) {
  var r = Q.refOf(t);
  if (r === X.p.pin) Q.clear(X.p, false); else Q.pin(X.p, r, t, 'graph');
}
function search(X, q) {
  q = q.trim().toLowerCase(); X.q = q;
  var hits = X.hits = q ? X.N.filter(function (n) { return n.label.toLowerCase().indexOf(q) >= 0; }) : [];
  X.svg.classList.toggle('q', !!q);
  X.N.forEach(function (n) { n.g.classList.toggle('hit', hits.indexOf(n) >= 0); });
  X.res.textContent = '';
  X.cnt.textContent = !q ? '' : hits.length ? (hits.length === 1 ? '1 node matches.' : hits.length + ' nodes match.') + ' Enter shows the first.' :
    'No node matches “' + q + '”.';
  hits.forEach(function (n) {
    var b = btn('lk', h('li', '', X.res), n.label);
    b.addEventListener('click', function () { go(X, n); });
  });
  X.drop.hidden = !q;
}
function go(X, n) {
  var S = size(X), k = Math.max(X.k, 1.2);
  X.drop.hidden = true;
  // Show the chosen node's pathways, not the search dimming. Typing again searches again.
  X.svg.classList.remove('q');
  view(X, k, S[0] / 2 - n.x * k, S[1] / 2 - n.y * k, true);
  if (X.p.pin !== n.ref) Q.pin(X.p, n.ref, n.g, 'graph');
}

// ---------- the dialog ----------
function create(p) {
  var X = model(p), k = p.k, name = k === 'findings' ? 'Findings' : 'Network';
  X.p = p; X.k = 1; X.tx = 0; X.ty = 0; X.cs = 1; X.alpha = 1; X.target = 0; X.hits = [];
  var ov = X.ov = h('div', 'xv');
  ov.hidden = true;
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'xvh-' + k);
  var top = h('div', 'xv-top', ov), hd = h('h2', 'xv-h', top, name + ' ');
  hd.id = 'xvh-' + k;
  h('span', 'muted', hd, 'expanded');
  var sr = h('div', 'xv-srch', top), lb = h('label', 'vh', sr, 'Search nodes'), qi = X.qi = h('input', '', sr);
  qi.type = 'search'; qi.id = 'xq-' + k; lb.htmlFor = qi.id; qi.placeholder = 'Search nodes'; qi.autocomplete = 'off';
  X.drop = h('div', 'xv-res', sr);
  X.drop.hidden = true;
  X.cnt = h('p', 'rc', X.drop);
  X.cnt.setAttribute('aria-live', 'polite');
  X.res = h('ul', '', X.drop);
  X.slot = h('div', 'xv-stat', top);
  var z = h('div', 'xv-zoom', top);
  z.setAttribute('role', 'group'); z.setAttribute('aria-label', 'Zoom');
  var zo = btn('', z, '−', 'Zoom out');
  X.zl = h('span', 'xv-zl', z, '100%');
  var zi = btn('', z, '+', 'Zoom in'), zf = btn('', z, 'Fit', 'Fit the graph to the screen');
  var cl = btn('xv-x', top, '×', 'Close expanded view');
  var cv = h('div', 'xv-cv', ov);
  X.svg = sv('svg', {'class': 'xg', tabindex: 0, role: 'group', 'aria-label': 'Expanded graph of the ' + name.toLowerCase() +
    '. Plus and minus keys zoom, 0 fits, arrow keys pan. Tab moves through nodes and chips; Enter selects.'}, cv);
  // footer: legend, how to use it, and the path note
  var ft = h('div', 'xv-foot', ov), lg = h('p', '', ft);
  DORD.forEach(function (d) { var sp = h('span', 'd-' + d, lg); h('b', 'gl', sp, Q.DIR[d][0]); sp.appendChild(doc.createTextNode(' ' + Q.DIR[d][1])); });
  h('span', '', lg, '●●●● certainty (filled of 4)');
  h('span', '', lg, 'line width = studies');
  h('span', '', lg, 'faded = not selected');
  h('span', '', lg, '- - No evidence: a gap, not a negative result');
  if (X.E.some(function (e) { return e.te; })) h('span', '', lg, '···◆ changes the effect of that edge (moderation)');
  var kinds = [], sh = h('p', '', ft);
  X.N.forEach(function (n) { if (kinds.indexOf(n.kind) < 0) kinds.push(n.kind); });
  h('span', '', sh, 'Shapes:');
  kinds.forEach(function (kd) { h('span', '', sh, SHAPE[kd][0] + ' ' + SHAPE[kd][1]); });
  h('p', 'xv-hint', ft, 'Scroll or pinch to zoom. Drag the canvas to pan; drag a node to move it. Click a node or a chip to select it. Keys: + − zoom, 0 fits, arrows pan, / searches, Esc closes.');
  var pn = $('#pathnote-' + k);
  if (pn) h('p', 'note', ft, pn.textContent);
  p.el.appendChild(ov);

  render(X);
  for (var i = 0; i < 320; i++) tick(X);
  X.alpha = 0;
  draw(X);

  // Share selection, filters and highlighting with the panel.
  var els = $$('[data-ref]', X.svg);
  Q.index(p, els);
  p.gEls = p.gEls.concat(els);
  p.nodes = p.nodes.concat(X.N.map(function (n) { return n.g; }));
  X.M.forEach(function (m) { p.mems.push({el: m.el, m: m.m.id, c: m.c.id}); });
  p.xsvg = X.svg;
  Q.refresh(p);

  // controls
  zo.addEventListener('click', function () { var S = size(X); zoomAt(X, 1 / 1.3, S[0] / 2, S[1] / 2, true); });
  zi.addEventListener('click', function () { var S = size(X); zoomAt(X, 1.3, S[0] / 2, S[1] / 2, true); });
  zf.addEventListener('click', function () { fit(X, true); });
  cl.addEventListener('click', function () { close(X); });
  qi.addEventListener('input', function () { search(X, qi.value); });
  qi.addEventListener('focus', function () { if (X.q) X.drop.hidden = false; });
  qi.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && X.hits.length) { e.preventDefault(); go(X, X.hits[0]); }
    else if (e.key === 'ArrowDown' && !X.drop.hidden && $('button', X.res)) { e.preventDefault(); $('button', X.res).focus(); }
  });
  X.res.addEventListener('keydown', function (e) {
    var li = e.target.closest('li'), to = e.key === 'ArrowDown' ? li.nextElementSibling : e.key === 'ArrowUp' ? li.previousElementSibling : undefined;
    if (to === undefined) return;
    e.preventDefault();
    if (to) $('button', to).focus(); else if (e.key === 'ArrowUp') qi.focus();
  });
  ov.addEventListener('click', function (e) { if (!e.target.closest('.xv-srch')) X.drop.hidden = true; });
  ov.addEventListener('keydown', function (e) {
    var inq = e.target === qi;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (X.q) { qi.value = ''; search(X, ''); qi.focus(); } else close(X);
      return;
    }
    if (inq || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === '/') { e.preventDefault(); e.stopPropagation(); qi.focus(); return; }
    if (!e.target.closest('.xv-cv')) return;
    var S = size(X), P = {ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80]}[e.key];
    if (e.key === '+' || e.key === '=') zoomAt(X, 1.25, S[0] / 2, S[1] / 2, true);
    else if (e.key === '-' || e.key === '_') zoomAt(X, 0.8, S[0] / 2, S[1] / 2, true);
    else if (e.key === '0') fit(X, true);
    else if (P) view(X, X.k, X.tx + P[0], X.ty + P[1], true);
    else if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-ref]')) choose(X, e.target.closest('[data-ref]'));
    else return;
    e.preventDefault(); e.stopPropagation();
  });

  // pointer: drag a node, pan the canvas, pinch to zoom; a click without movement selects
  var ptr = {}, svg = X.svg;
  svg.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    ptr[e.pointerId] = [e.clientX, e.clientY];
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
    var ids = Object.keys(ptr);
    if (ids.length === 2) {
      var a = ptr[ids[0]], b = ptr[ids[1]];
      X.pinch = {d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, k: X.k}; X.drag = null;
      return;
    }
    var nd = e.target.closest('.xnd');
    X.drag = {x: e.clientX, y: e.clientY, tx: X.tx, ty: X.ty, moved: false, hit: e.target.closest('[data-ref]'),
      node: nd ? X.N.filter(function (n) { return n.g === nd; })[0] : null};
  });
  svg.addEventListener('pointermove', function (e) {
    if (!ptr[e.pointerId]) return;
    ptr[e.pointerId] = [e.clientX, e.clientY];
    if (X.pinch) {
      var ids = Object.keys(ptr), a = ptr[ids[0]], b = ptr[ids[1]], r = svg.getBoundingClientRect();
      if (!b) return;
      zoomAt(X, X.pinch.k * (Math.hypot(a[0] - b[0], a[1] - b[1]) / X.pinch.d) / X.k, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
      return;
    }
    var D = X.drag;
    if (!D) return;
    var dx = e.clientX - D.x, dy = e.clientY - D.y;
    if (!D.moved && dx * dx + dy * dy < 16) return;
    D.moved = true;
    if (D.node) {
      var w = world(X, e);
      D.node.fx = w.x; D.node.fy = w.y;
      if (still.matches) { D.node.x = w.x; D.node.y = w.y; draw(X); }
      else { X.target = 0.25; X.alpha = Math.max(X.alpha, 0.25); run(X); }
    } else {
      svg.classList.add('panning');
      setView(X, X.k, D.tx + dx, D.ty + dy);
    }
  });
  function up(e) {
    if (!ptr[e.pointerId]) return;
    delete ptr[e.pointerId];
    svg.classList.remove('panning');
    if (X.pinch) { if (Object.keys(ptr).length < 2) X.pinch = null; X.drag = null; return; }
    var D = X.drag;
    X.drag = null;
    if (!D) return;
    if (D.node && D.moved) {
      // Let go: the node rejoins the layout. With reduced motion it stays where it was dropped.
      if (!still.matches) { D.node.fx = D.node.fy = null; X.target = 0; }
      else { D.node.fx = D.node.fy = null; }
    }
    if (!D.moved && e.type === 'pointerup') {
      if (D.hit) choose(X, D.hit); else if (X.p.pin) Q.clear(X.p, false);
    }
  }
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = svg.getBoundingClientRect(), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(X, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
  }, {passive: false});
  // Keep the centre still when the canvas changes size (the drawer column opens or closes).
  if (window.ResizeObserver) new ResizeObserver(function () {
    var S = size(X);
    if (!S[0] || !S[1]) return;
    if (X.W) setView(X, X.k, X.tx + (S[0] - X.W) / 2, X.ty + (S[1] - X.H) / 2);
    X.W = S[0]; X.H = S[1];
  }).observe(svg);
  return X;
}

function open(p, opener) {
  var X = p.xv || (p.xv = create(p)), dcol = $('.dcol', p.el), st = p.stat;
  if (p.xopen) return;
  X.btn = opener;
  // The drawer and the status line move into the dialog while it is open.
  X.back = [[dcol, dcol.parentNode, dcol.nextSibling], [st, st.parentNode, st.nextSibling]];
  X.ov.appendChild(dcol);
  X.slot.appendChild(st);
  X.ov.hidden = false;
  root.classList.add('xvopen');
  p.xopen = true;
  // Everything outside the dialog is inert while it is open.
  X.inert = [];
  for (var n = X.ov; n.parentNode && n !== doc.body; n = n.parentNode) {
    Array.prototype.forEach.call(n.parentNode.children, function (c) {
      if (c !== n && !c.inert && !/SCRIPT|STYLE|LINK/.test(c.tagName)) { c.inert = true; X.inert.push(c); }
    });
  }
  var S = size(X);
  X.W = S[0]; X.H = S[1];
  if (!X.fitted) { X.fitted = true; fit(X, false); }
  (Q.wide.matches ? X.qi : X.svg).focus({preventScroll: true});
}
function close(X) {
  var p = X.p;
  X.inert.forEach(function (c) { c.inert = false; });
  X.back.forEach(function (b) { b[1].insertBefore(b[0], b[2]); });
  X.ov.hidden = true;
  X.drop.hidden = true;
  root.classList.remove('xvopen');
  p.xopen = false;
  if (X.btn) X.btn.focus();
}

window.Q1X = {open: open};
})();
