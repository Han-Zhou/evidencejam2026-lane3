// Q3 gap map (gapmap.js, with gapmap.css). app.js loads both the first time the "Gap map" tab opens.
// One matrix: rows are outcome groups, columns are intervention groups, one cell per pairing.
// A cell's fill is its certainty tier (electric indigo, --t1 to --t4); its dots say the same, so
// certainty is not shown by colour only. A hatched cell is a gap: no study in this corpus tested
// that pairing. It is not a negative result. Every direction, certainty, rationale and count is the
// pack's own (data/gapmap.json, from answers/q3_grassland_gaps.json). The page only sorts, filters,
// counts and draws them. Claims and quotes (data/gapmap-claims.json) load on the first cell click.
(function () {
'use strict';
var Q = window.Q1, doc = document, root = doc.documentElement;
var esc = Q.esc, pl = Q.pl, CERT = Q.CERT, DIR = Q.DIR;
var TIERS = ['very_low', 'low', 'moderate', 'high'];
var AR = ' → ';
var GAPN = 'No study in this corpus tested this pairing. This is a gap, not a negative result.';
var DEN = {thin: 'thin (1 study)', some: 'some (2 to 3 studies)', dense: 'dense (4 or more studies)'};
var SORTS = [['pack', 'Pack order'], ['az', 'A to Z'], ['filled', 'Most filled cells'], ['studies', 'Most studies']];
var MINS = [[0, 'Any'], [2, 'Low or higher'], [3, 'Moderate or higher'], [4, 'High only']];
var HINT = 'Select a cell to read its claims. A hatched cell is a gap: no study tested that pairing.';
var EMPTY = 'Select a cell. Its certainty, rationale, claims and quotes show here.';
var XT = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// XLSX fills for the Matrix sheet: the light theme's tier colours (fill, text), very low first.
var XFILL = [['F1E6FF', '1A1A1A'], ['D7B8FF', '1A1A1A'], ['B47AFF', '1A1A1A'], ['6F00FF', 'FFFFFF']];
var S = {el: doc.getElementById('panel-gapmap'), k: 'gapmap', pin: null, sort: {r: 'pack', c: 'pack'}, show: {r: {}, c: {}},
  min: 0, empty: false};
S.host = S.el && S.el.querySelector('.q3host');

function $(s, el) { return (el || doc).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); }
function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
function lab(x) { return S.cl[x.c] + AR + S.rl[x.r]; }
function ok(x) { return x.ty === 'g' || CERT[x.cert][0] >= S.min; }
function aria(x) {
  if (x.ty === 'g') return lab(x) + ': no evidence. ' + GAPN;
  return lab(x) + ': ' + DIR[x.dir][1] + ', certainty ' + CERT[x.cert][1] + ', ' + pl(x.st, 'study', 'studies') + ', ' + pl(x.n, 'claim', 'claims');
}

// ---------- start: load the map file once, then draw ----------
function show() {
  if (S.ready || S.wait || !S.host) return;
  S.wait = getJSON('data/gapmap.json').then(init, function () {
    S.wait = null;
    S.host.innerHTML = '<p>Could not load the gap map. Every finding, gap and quote is on the <a href="claims-gapmap.html">Q3 claims page</a>.</p>';
  });
}
function init(D) {
  S.D = D; S.cell = {}; S.F = []; S.rl = {}; S.cl = {};
  S.rows = D.rows.map(function (r, i) { S.rl[r[0]] = r[1]; S.show.r[r[0]] = true; return {id: r[0], label: r[1], i: i}; });
  S.cols = D.cols.map(function (c, i) { S.cl[c[0]] = c[1]; S.show.c[c[0]] = true; return {id: c[0], label: c[1], i: i}; });
  D.f.forEach(function (f) { f.ty = 'f'; S.cell[f.r + '|' + f.c] = f; S.F.push(f); });
  D.g.forEach(function (g) { S.cell[g[1] + '|' + g[2]] = {ty: 'g', id: g[0], r: g[1], c: g[2], status: g[3]}; });
  S.byId = {};
  Object.keys(S.cell).forEach(function (k) { S.byId[S.cell[k].id] = S.cell[k]; });
  S.host.innerHTML = skeleton(D);
  S.host.removeAttribute('aria-busy');
  S.table = $('.q3t', S.host); S.hr = $('thead tr', S.table); S.tb = S.table.tBodies[0];
  S.st = $('.q3st', S.host); S.dr = $('.q3dr', S.host);
  S.th = {}; S.tr = {}; S.td = {};
  $$('th[data-c]', S.hr).forEach(function (n) { S.th[n.getAttribute('data-c')] = n; });
  $$('tr[data-r]', S.tb).forEach(function (tr) {
    var r = tr.getAttribute('data-r');
    S.tr[r] = tr;
    $$('td[data-c]', tr).forEach(function (td) {
      var x = S.cell[r + '|' + td.getAttribute('data-c')];
      S.td[r + '|' + x.c] = td;
      x.el = x.ty === 'f' ? $('button', td) : td;
    });
  });
  wire();
  arrange();
  status();
  S.ready = true;
}

// ---------- markup ----------
function swatch(t) { return '<span class="cs t-' + t + '"><span class="dots" aria-hidden="true">' + Q.dots(t) + '</span></span>'; }
function opts(list, cur) {
  return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
}
function pick(ax, items, what) {
  return '<details class="q3pick" data-pick="' + ax + '"><summary><span class="q3ps"></span><span class="vh"> ' + what + '</span></summary>' +
    '<div class="q3pop"><div class="q3pa"><button type="button" class="tbtn" data-all="' + ax + '">All</button>' +
    '<button type="button" class="tbtn" data-none="' + ax + '">None</button></div>' +
    items.map(function (x) {
      return '<label><input type="checkbox" data-ax="' + ax + '" value="' + esc(x.id) + '" checked> ' + esc(x.label) + '</label>';
    }).join('') + '</div></details>';
}
function corner() {
  return '<td class="q3k"><div class="q3ctl" role="group" aria-label="Sort and filter the map">' +
    '<p class="q3ax">Rows: outcomes</p>' +
    '<label>Sort <select data-sort="r">' + opts(SORTS, 'pack') + '</select></label>' + pick('r', S.rows, 'outcomes') +
    '<p class="q3ax">Columns: interventions</p>' +
    '<label>Sort <select data-sort="c">' + opts(SORTS, 'pack') + '</select></label>' + pick('c', S.cols, 'interventions') +
    '<p class="q3ax">Cells</p>' +
    '<label>Certainty <select data-min>' + opts(MINS, 0) + '</select></label>' +
    '<label class="cb"><input type="checkbox" data-empty> Hide empty rows and columns</label></div></td>';
}
function cellHtml(x) {
  if (x.ty === 'g') return '<td class="q3g" data-c="' + esc(x.c) + '" data-q3-gap-id="' + esc(x.id) + '"><span class="vh">No evidence</span></td>';
  return '<td data-c="' + esc(x.c) + '"><button type="button" class="q3c t-' + x.cert + '" data-q3-finding-id="' + esc(x.id) +
    '" data-direction="' + esc(x.dir) + '" data-certainty="' + esc(x.cert) + '" data-studies="' + x.st + '" data-claims="' + x.n +
    '" data-density="' + esc(x.den) + '" aria-label="' + esc(aria(x)) + '"><span class="dots" aria-hidden="true">' + Q.dots(x.cert) + '</span></button></td>';
}
function skeleton(D) {
  var n = {};
  S.F.forEach(function (f) { n[f.cert] = (n[f.cert] || 0) + 1; });
  var dense = D.densest.map(function (id) {
    var x = S.byId[id];
    return x ? '<li><button type="button" data-go="' + esc(id) + '">' + esc(lab(x)) + '</button> <span class="muted">' + pl(x.st, 'study', 'studies') + '</span></li>' : '';
  }).join('');
  var legend = '<div class="q3leg" role="group" aria-label="Legend"><span class="q3lt">Certainty</span>' +
    TIERS.map(function (t) { return '<span class="ck">' + swatch(t) + CERT[t][1] + ' <span class="muted">' + (n[t] || 0) + '</span></span>'; }).join('') +
    '<span class="ck"><span class="q3gs" aria-hidden="true"></span>No evidence (gap): no study tested the pairing. Not a negative result.</span></div>';
  var table = '<table class="q3t"><caption class="vh">Gap map. Rows are outcome groups, columns are intervention groups. ' +
    'A cell with dots has evidence; the dots and the fill give its certainty. A cell marked no evidence is a gap.</caption>' +
    '<thead><tr>' + corner() + S.cols.map(function (c) {
      return '<th scope="col" data-c="' + esc(c.id) + '"><span>' + esc(c.label) + '</span></th>';
    }).join('') + '</tr></thead><tbody>' + S.rows.map(function (r) {
      return '<tr data-r="' + esc(r.id) + '"><th scope="row">' + esc(r.label) + '</th>' + S.cols.map(function (c) {
        return cellHtml(S.cell[r.id + '|' + c.id]);
      }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
  return '<p class="q3sum">' + esc(D.summary) + '</p>' +
    '<details class="q3dense"><summary>The ten densest cells (most studies)</summary><ol>' + dense + '</ol></details>' +
    '<div class="q3top">' + legend + '<div class="seg xp" role="group" aria-label="Export the map as shown">' +
    '<button type="button" class="tbtn" data-gm="csv">Export CSV</button><button type="button" class="tbtn" data-gm="xlsx">Export XLSX</button>' +
    '<button type="button" class="tbtn" data-gm="copy">Copy image</button></div></div>' +
    '<div class="selbar q3st"><div class="acts" hidden><button type="button" class="tod">Details below</button>' +
    '<button type="button" class="clr">Clear</button></div><div class="sd" role="status" aria-live="polite"></div></div>' +
    '<div class="gcard q3card"><div class="q3box">' + table + '</div>' +
    '<div class="gact"><p class="q3n"></p><button type="button" class="tbtn" data-gm="png">Download PNG</button></div></div>' +
    '<section class="drawer q3dr" aria-labelledby="q3drh"><div class="dr-head"><h3 id="q3drh" tabindex="-1">Details</h3>' +
    '<button type="button" class="x" aria-label="Close details">×</button></div><div class="dr-body"><p class="muted">' + EMPTY + '</p></div></section>' +
    '<details class="q3lim"><summary>Limitations and how this map was built</summary><ul class="lims">' +
    D.lims.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul><p>' + esc(D.how) + '</p>' +
    '<p>Certainty rule: <code>' + esc(D.rule) + '</code>. Source file: <code>answers/q3_grassland_gaps.json</code>.</p></details>';
}

// ---------- sort and filter ----------
// Rows and columns the reader shows, then (if asked) without the ones that have no finding at
// the chosen certainty. "Most filled cells" and "Most studies" count over the shown cells; ties keep
// the pack order. Studies are summed over cells, so a study that counts in two cells counts twice.
function view() {
  var rows = S.rows.filter(function (r) { return S.show.r[r.id]; });
  var cols = S.cols.filter(function (c) { return S.show.c[c.id]; });
  var rs = {}, cs = {};
  rows.forEach(function (r) { rs[r.id] = {n: 0, st: 0}; });
  cols.forEach(function (c) { cs[c.id] = {n: 0, st: 0}; });
  rows.forEach(function (r) {
    cols.forEach(function (c) {
      var x = S.cell[r.id + '|' + c.id];
      if (x.ty === 'f' && ok(x)) { rs[r.id].n++; rs[r.id].st += x.st; cs[c.id].n++; cs[c.id].st += x.st; }
    });
  });
  if (S.empty) {
    rows = rows.filter(function (r) { return rs[r.id].n; });
    cols = cols.filter(function (c) { return cs[c.id].n; });
  }
  function order(list, how, st) {
    return list.sort(function (a, b) {
      if (how === 'az') return a.label.localeCompare(b.label);
      if (how === 'filled') return st[b.id].n - st[a.id].n || a.i - b.i;
      if (how === 'studies') return st[b.id].st - st[a.id].st || a.i - b.i;
      return a.i - b.i;
    });
  }
  return {rows: order(rows, S.sort.r, rs), cols: order(cols, S.sort.c, cs)};
}
// Move the existing rows and cells into the new order (nothing is rebuilt, so focus stays put).
function arrange() {
  var V = S.V = view(), rin = {}, cin = {};
  V.rows.forEach(function (r) { rin[r.id] = 1; });
  V.cols.forEach(function (c) { cin[c.id] = 1; });
  var cord = V.cols.concat(S.cols.filter(function (c) { return !cin[c.id]; }));
  var rord = V.rows.concat(S.rows.filter(function (r) { return !rin[r.id]; }));
  cord.forEach(function (c) { var th = S.th[c.id]; th.hidden = !cin[c.id]; S.hr.appendChild(th); });
  rord.forEach(function (r) {
    var tr = S.tr[r.id];
    tr.hidden = !rin[r.id];
    S.tb.appendChild(tr);
    cord.forEach(function (c) { var td = S.td[r.id + '|' + c.id]; td.hidden = !cin[c.id]; tr.appendChild(td); });
  });
  S.F.forEach(function (f) { var y = ok(f); f.el.classList.toggle('off', !y); f.el.tabIndex = y ? 0 : -1; });
  S.table.style.setProperty('--nc', V.cols.length);
  var shown = 0;
  V.rows.forEach(function (r) { V.cols.forEach(function (c) { var x = S.cell[r.id + '|' + c.id]; if (x.ty === 'f' && ok(x)) shown++; }); });
  $('.q3n', S.host).textContent = 'Showing ' + V.rows.length + ' of ' + S.rows.length + ' outcomes, ' + V.cols.length + ' of ' + S.cols.length +
    ' interventions, ' + shown + ' of ' + S.F.length + ' findings';
  ['r', 'c'].forEach(function (ax) {
    var all = ax === 'r' ? S.rows : S.cols, k = all.filter(function (x) { return S.show[ax][x.id]; }).length;
    $('[data-pick="' + ax + '"] .q3ps', S.host).textContent = 'Show ' + k + ' of ' + all.length;
  });
}
function filtered() {
  return S.min > 0 || S.empty || S.rows.some(function (r) { return !S.show.r[r.id]; }) || S.cols.some(function (c) { return !S.show.c[c.id]; });
}

// ---------- selection, status line and details ----------
function status() {
  var sd = $('.sd', S.st), x = S.pin, h;
  function u(s) { return '<span class="unit">' + s + '</span>'; }
  if (!x) h = HINT;
  else if (x.ty === 'g') h = '<span class="dsc"><b>' + esc(lab(x)) + '</b> · <span class="nev">No evidence</span> · ' + GAPN + '</span>';
  else h = '<span class="dsc"><b>' + esc(lab(x)) + '</b> · ' + u(Q.dirH(x.dir)) + ' · ' + u(Q.certH(x.cert) + ' certainty') + ' · ' +
    u(pl(x.st, 'study', 'studies')) + ' · ' + u(pl(x.n, 'claim', 'claims')) + '</span>';
  $('.acts', S.st).hidden = !x;
  if (sd.getAttribute('data-h') !== h) { sd.innerHTML = h; sd.setAttribute('data-h', h); }
}
function mark() {
  $$('.pin, .on', S.table).forEach(function (n) { n.classList.remove('pin', 'on'); });
  var x = S.pin;
  if (!x) return;
  x.el.classList.add('pin');
  S.th[x.c].classList.add('on');
  $('th', S.tr[x.r]).classList.add('on');
}
function claims() {
  if (!S.cw) S.cw = getJSON('data/gapmap-claims.json').then(function (C) {
    S.C = C; S.cp = {k: S.k, data: {claims: C.claims, papers: C.papers}};
    return C;
  }, function (e) { S.cw = null; throw e; });
  return S.cw;
}
function detail(x) {
  var C = S.C, h;
  if (x.ty === 'g') {
    return '<p class="big"><b>No evidence</b></p><p>' + esc(C.gapNote) + '</p><p class="rat">Searched for: ' + esc(C.sf[x.id]) + '</p>' +
      '<p>Intervention: <b>' + esc(S.cl[x.c]) + '</b><br>Outcome: <b>' + esc(S.rl[x.r]) + '</b></p>';
  }
  h = '<p class="big">' + Q.certH(x.cert) + ' certainty · ' + Q.dirH(x.dir) + '</p><p class="rat">' + esc(x.rat) + '</p>';
  h += '<p>' + pl(x.st, 'study', 'studies') + ' · ' + pl(x.n, 'claim', 'claims') + ' · density ' + esc(DEN[x.den] || x.den) + '</p>' + Q.sdBar(x.sd);
  h += '<p>Intervention: <b>' + esc(S.cl[x.c]) + '</b><br>Outcome: <b>' + esc(S.rl[x.r]) + '</b></p>';
  return h + Q.byPaper(S.cp, C.ids[x.id], 'Claims by paper');
}
function select(x, opener) {
  if (S.pin === x) { clear(true); return; }
  S.pin = x; S.opener = opener || x.el;
  mark(); status();
  $('h3', S.dr).textContent = lab(x);
  $('.dr-body', S.dr).innerHTML = '<p class="muted">Loading the claims…</p>';
  claims().then(function () {
    if (S.pin !== x) return;
    $('.dr-body', S.dr).innerHTML = detail(x);
  }, function () {
    $('.dr-body', S.dr).innerHTML = '<p>Could not load the claims file. Open the <a href="claims-gapmap.html#' +
      (x.ty === 'g' ? 'g-' : 'f-') + esc(x.id.replace(/[^A-Za-z0-9_-]/g, '-')) + '">Q3 claims page</a> instead.</p>';
  });
}
function clear(refocus) {
  var o = S.opener;
  S.pin = null; mark(); status();
  $('h3', S.dr).textContent = 'Details';
  $('.dr-body', S.dr).innerHTML = '<p class="muted">' + EMPTY + '</p>';
  if (refocus && o && o.isConnected && o.getClientRects().length) o.focus();
}

// ---------- image: the map as shown, drawn on a canvas in the current theme ----------
function wrap(x, text, max) {
  var out = [], line = '';
  String(text).split(' ').forEach(function (w) {
    var t = line ? line + ' ' + w : w;
    if (line && x.measureText(t).width > max) { out.push(line); line = w; } else line = t;
  });
  if (line) out.push(line);
  return out;
}
function rr(x, a, b, w, h, r) {
  x.beginPath();
  if (x.roundRect) x.roundRect(a, b, w, h, r); else x.rect(a, b, w, h);
}
function canvas() {
  var V = S.V, cs = getComputedStyle(root);
  function v(n) { return cs.getPropertyValue(n).trim(); }
  var sans = v('--sans') || 'sans-serif', mono = v('--mono') || 'monospace';
  var pad = 28, rowW = 250, colW = 44, cellH = 32, sp = 3, lh = 14, s = 2;
  var cv = doc.createElement('canvas'), x = cv.getContext('2d');
  x.font = '12px ' + sans;
  var heads = V.cols.map(function (c) { return wrap(x, c.label, 180); });
  var headH = 20 + Math.max.apply(null, [60].concat(heads.map(function (ls) {
    return Math.max.apply(null, ls.map(function (l) { return x.measureText(l).width; }));
  })));
  var rows = V.rows.map(function (r) { return wrap(x, r.label, rowW - 16).slice(0, 2); });
  var foot = ['Source: answers/q3_grassland_gaps.json · certainty rule ' + S.D.rule + '. Fill and dots: certainty of the pooled finding.',
    'A hatched cell is a gap: no study in this corpus tested the pairing. It is not a negative result.'];
  if (filtered()) foot.push($('.q3n', S.host).textContent + (S.min ? ' (certainty ' + MINS.filter(function (m) { return m[0] === S.min; })[0][1].toLowerCase() + ')' : '') + '.');
  var top = pad + 26 + 20 + 38;
  var W = Math.max(820, pad * 2 + rowW + V.cols.length * colW), H = top + headH + V.rows.length * cellH + 18 + foot.length * 16 + pad;
  cv.width = W * s; cv.height = H * s;
  x.scale(s, s);
  x.fillStyle = v('--surface'); x.fillRect(0, 0, W, H);
  x.textBaseline = 'middle';
  x.fillStyle = v('--text'); x.font = '600 18px ' + sans;
  x.fillText('Grassland restoration in Canada: evidence gap map', pad, pad + 10);
  x.fillStyle = v('--text-2'); x.font = '12px ' + sans;
  x.fillText('Rows: outcome groups · Columns: intervention groups · ' + V.rows.length + ' × ' + V.cols.length + ' cells shown', pad, pad + 34);
  // legend
  var lx = pad, ly = pad + 64;
  x.font = '600 12px ' + sans; x.fillStyle = v('--text'); x.fillText('Certainty', lx, ly); lx += x.measureText('Certainty').width + 12;
  TIERS.forEach(function (t, i) {
    rr(x, lx, ly - 10, 40, 20, 5); x.fillStyle = v('--t' + (i + 1)); x.fill();
    x.strokeStyle = v('--line'); x.lineWidth = 1; x.stroke();
    x.fillStyle = v('--t' + (i + 1) + '-fg'); x.font = '9px ' + mono; x.textAlign = 'center'; x.fillText(Q.dots(t), lx + 20, ly + 1);
    x.textAlign = 'left'; x.fillStyle = v('--text-2'); x.font = '12px ' + sans; x.fillText(CERT[t][1], lx + 48, ly);
    lx += 56 + x.measureText(CERT[t][1]).width;
  });
  hatch(x, v, lx, ly - 10, 40, 20);
  x.fillStyle = v('--text-2'); x.fillText('No evidence (gap)', lx + 48, ly);
  // column labels, read from the bottom up
  var gx = pad + rowW, gy = top + headH;
  x.font = '12px ' + sans; x.fillStyle = v('--text-2');
  heads.forEach(function (ls, i) {
    x.save();
    x.translate(gx + i * colW + colW / 2, gy - 8);
    x.rotate(-Math.PI / 2);
    ls.forEach(function (l, j) { x.fillText(l, 0, (j - (ls.length - 1) / 2) * lh); });
    x.restore();
  });
  // rows and cells
  V.rows.forEach(function (r, j) {
    var y = gy + j * cellH;
    x.font = '12px ' + sans; x.fillStyle = v('--text-2');
    rows[j].forEach(function (l, k) { x.fillText(l, pad, y + cellH / 2 + (k - (rows[j].length - 1) / 2) * lh); });
    V.cols.forEach(function (c, i) {
      var cx = gx + i * colW, z = S.cell[r.id + '|' + c.id], w = colW - sp, h = cellH - sp;
      if (z.ty === 'g') { hatch(x, v, cx, y, w, h); return; }
      var t = TIERS.indexOf(z.cert) + 1;
      x.globalAlpha = ok(z) ? 1 : 0.15;
      rr(x, cx, y, w, h, 6); x.fillStyle = v('--t' + t); x.fill();
      x.strokeStyle = v('--line'); x.lineWidth = 1; x.stroke();
      x.fillStyle = v('--t' + t + '-fg'); x.font = '600 9px ' + mono; x.textAlign = 'center';
      x.fillText(Q.dots(z.cert), cx + w / 2, y + h / 2 + 1);
      x.textAlign = 'left'; x.globalAlpha = 1;
    });
  });
  x.font = '11px ' + sans; x.fillStyle = v('--text-3');
  foot.forEach(function (l, i) { x.fillText(l, pad, gy + V.rows.length * cellH + 18 + i * 16); });
  return cv;
}
function hatch(x, v, a, b, w, h) {
  x.save();
  rr(x, a, b, w, h, 6); x.clip();
  x.strokeStyle = v('--line-strong'); x.lineWidth = 1;
  for (var k = -h; k < w; k += 6) { x.beginPath(); x.moveTo(a + k, b + h); x.lineTo(a + k + h, b); x.stroke(); }
  x.restore();
  rr(x, a + .5, b + .5, w - 1, h - 1, 6);
  x.setLineDash([3, 3]); x.strokeStyle = v('--text-3'); x.lineWidth = 1; x.stroke(); x.setLineDash([]);
}
function png() {
  var cv = canvas();
  return new Promise(function (y, n) { cv.toBlob(function (b) { if (b) y(b); else n(new Error('toBlob')); }, 'image/png'); });
}
function fname(ext) { return 'q3-gapmap-' + (filtered() ? 'visible' : 'all') + '.' + ext; }
function save(blob, name) {
  var u = URL.createObjectURL(blob), a = doc.createElement('a');
  a.href = u; a.download = name; a.hidden = true;
  doc.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 4e4);
}
// Button text for about 2 s, and the same news in a polite live region.
function say(btn, txt, msg) {
  var lv = S.live;
  if (!lv) { lv = S.live = doc.createElement('p'); lv.className = 'vh'; lv.setAttribute('role', 'status'); S.el.appendChild(lv); }
  if (btn._t) clearTimeout(btn._t); else btn._o = btn.textContent;
  btn.textContent = txt;
  lv.textContent = '';
  setTimeout(function () { lv.textContent = msg; }, 80);
  btn._t = setTimeout(function () { btn.textContent = btn._o; btn._t = 0; }, 2000);
}
function download(btn) {
  var name = fname('png');
  png().then(function (b) { save(b, name); say(btn, 'Saved', 'Downloaded the map image as ' + name + '.'); },
    function () { say(btn, 'Failed', 'Could not make the map image.'); });
}
// The clipboard write starts inside the click, with a Promise for the image (Safari needs this).
function copy(btn) {
  var blob = png(), CI = window.ClipboardItem, name = fname('png'), job;
  function fallback() { return blob.then(function (b) { save(b, name); return ['Downloaded', 'Could not copy to the clipboard. The map image was downloaded as ' + name + '.']; }); }
  try {
    if (!CI || !navigator.clipboard || (CI.supports && !CI.supports('image/png'))) throw 0;
    job = navigator.clipboard.write([new CI({'image/png': blob})]).then(function () { return ['Copied', 'Map image copied to the clipboard.']; }, fallback);
  } catch (e) { job = fallback(); }
  job.then(function (m) { say(btn, m[0], m[1]); }, function () { say(btn, 'Failed', 'Could not make the map image.'); });
}

// ---------- CSV and XLSX: the map as shown (rows, columns and certainty filter) ----------
var HEAD = ['cell id', 'kind', 'outcome', 'intervention', 'outcome id', 'intervention id', 'status', 'direction', 'direction label',
  'certainty', 'certainty label', 'certainty_rationale', 'studies', 'claims', 'density', 'study directions', 'claim directions',
  'searched_for', 'claim ids', 'document ids'];
var CHEAD = ['cell id', 'claim id', 'subject', 'predicate', 'object', 'negated', 'claim direction', 'claim grade',
  'evidence types', 'comparator', 'quote', 'paper title', 'year', 'DOI or document id'];
// {increase: 1, mixed: 2} -> "increase 1; mixed 2", in the app's direction order.
function counts(o) {
  var D = Q.DORD;
  return o ? Object.keys(o).sort(function (a, b) { return (D.indexOf(a) + 1 || 99) - (D.indexOf(b) + 1 || 99); })
    .map(function (d) { return d + ' ' + o[d]; }).join('; ') : '';
}
function shownCells() {
  var out = [];
  S.V.rows.forEach(function (r) { S.V.cols.forEach(function (c) { var x = S.cell[r.id + '|' + c.id]; if (ok(x)) out.push(x); }); });
  return out;
}
function row(x) {
  var C = S.C;
  if (x.ty === 'g') return [x.id, 'gap', S.rl[x.r], S.cl[x.c], x.r, x.c, x.status, '', 'No evidence: ' + GAPN, '', '', '', 0, 0, '', '', '',
    C.sf[x.id], '', ''];
  return [x.id, 'finding', S.rl[x.r], S.cl[x.c], x.r, x.c, '', x.dir, DIR[x.dir][1], x.cert, CERT[x.cert][1], x.rat, x.st, x.n, x.den,
    counts(x.sd), counts(x.cd), '', C.ids[x.id].join(';'), C.docs[x.id].join(';')];
}
function matrix() {
  var out = [['Outcome \\ intervention'].concat(S.V.cols.map(function (c) { return c.label; }))];
  S.V.rows.forEach(function (r) {
    out.push([r.label].concat(S.V.cols.map(function (c) {
      var x = S.cell[r.id + '|' + c.id];
      if (x.ty === 'g') return 'No evidence';
      if (!ok(x)) return 'Below the certainty filter';
      return {v: CERT[x.cert][1] + ' · ' + pl(x.st, 'study', 'studies'), s: 2 + TIERS.indexOf(x.cert)};
    })));
  });
  out.push([]);
  out.push(['Fill: certainty of the pooled finding, from very low (lightest) to high (darkest).']);
  out.push(['No evidence: a gap. No study in this corpus tested the pairing. It is not a negative result.']);
  out.push(['Source: answers/q3_grassland_gaps.json, certainty rule ' + S.D.rule + '.']);
  return out;
}
function exportData(fmt, btn) {
  Promise.all([Q.need('export'), claims()]).then(function () {
    var E = window.Q1Export, cells = shownCells(), name = fname(fmt), R = [HEAD], cl = [CHEAD];
    if (!cells.length) return say(btn, 'No rows', 'Nothing to download: the filters hide every cell.');
    cells.forEach(function (x) { R.push(row(x)); });
    if (fmt === 'csv') save(new Blob([E.csv(R)], {type: 'text/csv;charset=utf-8'}), name);
    else {
      cells.forEach(function (x) {
        if (x.ty !== 'f') return;
        S.C.ids[x.id].forEach(function (c) {
          var K = S.C.claims[c], P = S.C.papers[K.doc] || [];
          cl.push([x.id, c, K.s, K.p, K.o, !!K.n, K.d, K.g, (K.et || []).join('; '), K.c, K.q, P[0], P[1] == null ? '' : P[1], P[2] || K.doc]);
        });
      });
      save(new Blob(E.zip(E.book([['Matrix', matrix()], ['Cells', R], ['Claims', cl]], XFILL)), {type: XT}), name);
    }
    say(btn, 'Saved ' + pl(cells.length, 'row', 'rows'), 'Downloaded ' + name + ': ' + pl(cells.length, 'cell', 'cells') +
      (fmt === 'xlsx' ? ' and ' + pl(cl.length - 1, 'claim', 'claims') : '') + '.');
  }, function () { say(btn, 'Failed', 'Could not load the data. Nothing was downloaded.'); });
}

// ---------- events ----------
function wire() {
  var H = S.host;
  H.addEventListener('click', function (e) {
    var t = e.target, b;
    if ((b = t.closest('[data-gm]'))) {
      var a = b.getAttribute('data-gm');
      if (a === 'copy') copy(b); else if (a === 'png') download(b); else exportData(a, b);
      return;
    }
    if ((b = t.closest('button.q3c'))) { select(S.byId[b.getAttribute('data-q3-finding-id')], b); return; }
    if ((b = t.closest('td.q3g'))) { select(S.byId[b.getAttribute('data-q3-gap-id')], b); return; }
    if ((b = t.closest('[data-go]'))) {
      var x = S.byId[b.getAttribute('data-go')];
      select(x, b);
      if (S.pin === x) { x.el.scrollIntoView({block: 'center', inline: 'center'}); x.el.focus({preventScroll: true}); }
      return;
    }
    if (t.closest('.clr') || t.closest('.x')) { clear(true); return; }
    if (t.closest('.tod')) { S.dr.scrollIntoView({block: 'start'}); $('h3', S.dr).focus({preventScroll: true}); return; }
    if ((b = t.closest('[data-all], [data-none]'))) {
      var ax = b.getAttribute('data-all') || b.getAttribute('data-none'), on = b.hasAttribute('data-all');
      $$('input[data-ax="' + ax + '"]', H).forEach(function (i) { i.checked = on; S.show[ax][i.value] = on; });
      arrange();
    }
  });
  H.addEventListener('change', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-sort')) S.sort[t.getAttribute('data-sort')] = t.value;
    else if (t.hasAttribute('data-min')) S.min = +t.value;
    else if (t.hasAttribute('data-empty')) S.empty = t.checked;
    else if (t.hasAttribute('data-ax')) S.show[t.getAttribute('data-ax')][t.value] = t.checked;
    else return;
    arrange();
  });
  // One list open at a time; a click outside closes it.
  $$('.q3pick', H).forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) $$('.q3pick', H).forEach(function (o) { if (o !== d) o.open = false; }); });
  });
  doc.addEventListener('click', function (e) {
    $$('.q3pick[open]', H).forEach(function (d) { if (!d.contains(e.target)) d.open = false; });
  });
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !root.classList.contains('q3')) return;
    var d = $('.q3pick[open]', H);
    if (d) { d.open = false; $('summary', d).focus(); }
    else if (S.pin) clear(true);
  });
}

window.Q3 = {show: show};
})();
