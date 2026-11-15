// Q1 prototype, rank 1. Vanilla JS, no framework, no external requests.
// The page works without this file. It adds tabs, click highlighting of
// pathways, the drawer, search, lenses, filters, the matrix toggle, the theme
// toggle and the toolbar dock. Nothing in the graph reacts to hover.
// v5: the tables under the graph are switched off. Their code (sorting, paging,
// the Papers and Claims tables) is in comments marked "tables (switched off)".
(function () {
'use strict';
var doc = document, root = doc.documentElement;
var DIR = {increase: ['↑', 'Increase'], decrease: ['↓', 'Decrease'], mixed: ['↕', 'Mixed (studies disagree)'],
  no_effect: ['=', 'No effect (tested)'], unclear: ['?', 'Unclear']};
var DORD = ['increase', 'decrease', 'mixed', 'no_effect', 'unclear'];
var CERT = {high: [4, 'High'], moderate: [3, 'Moderate'], low: [2, 'Low'], very_low: [1, 'Very low']};
var AR = ' → ';
var P = {}, cur = 'findings';
var GAPN = 'No study in this corpus tested this pairing. This is a gap, not a negative result.';
var PATHN = 'Edges beyond the first step are separate bodies of evidence. A path is not one tested effect.';
var HINT = 'Click a node to highlight its pathways. Click an edge or its chip to read its claims.';
// Node kinds in the status line (one node, so singular). Findings nodes are factors or outcomes.
var KIND = {planting_stock: 'Planting stock', site_treatment: 'Site treatment', combination: 'Combination', condition: 'Condition',
  outcome: 'Outcome', factor: 'Factor'};
// Same text as DRAWER_EMPTY in build.py.
var EMPTY = 'Select a node or an edge. Its details, claims and quotes show here.';
var wide = matchMedia('(min-width: 900px)');

function $(s, el) { return (el || doc).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
function gl(d) { return '<span class="gl d-' + d + '" aria-hidden="true">' + DIR[d][0] + '</span>'; }
function dirH(d) { return gl(d) + ' ' + esc(DIR[d][1]); }
function dots(c) { var n = CERT[c][0]; return '●●●●'.slice(0, n) + '○○○○'.slice(0, 4 - n); }
function certH(c) { return '<span class="dots" aria-hidden="true">' + dots(c) + '</span> ' + CERT[c][1]; }
function pl(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
function un(s) { return String(s).replace(/_/g, ' '); }
function lab(it) { return it.kind === 'moderation' ? it.sl + AR + 'effect of ' + it.tl : it.sl + AR + it.tl; }
function go(ref, html) { return '<button type="button" class="lk" data-go="' + esc(ref) + '">' + html + '</button>'; }
function doiH(d, doi) { return doi ? '<a href="https://doi.org/' + esc(doi) + '">' + esc(doi) + '</a>' : '<span class="mono">' + esc(d) + '</span>'; }
function paperT(P_) { return esc(P_[0]) + (P_[1] != null ? ' (' + P_[1] + ')' : ''); }
function kindOf(ref) { return ref.split(':')[0]; }
// Elements are hooked by the machine-check attributes; data-ref covers the rest.
var HOOK = '[data-ref],[data-finding-id],[data-edge-id],[data-gap-id],[data-interaction-id],[data-node-id],[data-go]';
function refOf(n) {
  var d = n.dataset;
  return d.ref || d.go || (d.findingId != null ? 'finding:' + d.findingId : d.edgeId != null ? 'edge:' + d.edgeId :
    d.gapId != null ? 'gap:' + d.gapId : d.interactionId != null ? 'inter:' + d.interactionId : d.nodeId != null ? 'node:' + d.nodeId : null);
}
function index(p, els) { els.forEach(function (n) { var r = refOf(n); if (r) (p.refs[r] = p.refs[r] || []).push(n); }); }
function focusable(p, r) { return (p.refs[r] || []).filter(function (n) { return n.closest('svg') && n.hasAttribute('tabindex'); })[0]; }
function aria(it) {
  if (it.ty === 'gap') return it.sl + ' to ' + it.tl + ': no evidence. ' + GAPN;
  return (it.kind === 'moderation' ? it.sl + ' changes the effect of ' + it.tl : it.sl + ' to ' + it.tl) + ': ' + DIR[it.dir][1] +
    ', certainty ' + CERT[it.cert][1] + ', ' + pl(it.studies, 'study', 'studies') + ', ' + pl(it.claims, 'claim', 'claims');
}

function load(p) {
  if (p.data) return Promise.resolve(p.data);
  if (!p.wait) {
    p.wait = fetch('data/' + p.k + '.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        p.data = d; p.owner = {}; p.docRefs = {};
        Object.keys(d.items).forEach(function (r) {
          var it = d.items[r], docs = it.docs || (it.ty === 'inter' ? [d.claims[it.id].doc] : []);
          if (it.ids) it.ids.forEach(function (c) { p.owner[c] = r; });
          if (it.ty === 'inter') p.owner[it.id] = r;
          docs.forEach(function (x) { (p.docRefs[x] = p.docRefs[x] || []).push(r); });
        });
        refresh(p);
        return d;
      })
      .catch(function (e) { p.wait = null; throw e; });
  }
  return p.wait;
}

// ---------- theme toggle (SPEC 4.2) ----------
// Light is the default. The system setting is not read; dark only when the reader picks it.
var tbtn = $('.theme');
function theme() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
function syncTheme() {
  var d = theme() === 'dark';
  tbtn.setAttribute('aria-pressed', d ? 'true' : 'false');
  tbtn.setAttribute('aria-label', d ? 'Switch to light theme' : 'Switch to dark theme');
}
if (tbtn) {
  tbtn.addEventListener('click', function () {
    var t = theme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('q1-theme', t); } catch (e) {}
    syncTheme();
  });
  syncTheme();
}

// ---------- tabs and hash ----------
var tabs = $$('[data-tab]');
function select(k) {
  cur = k;
  root.classList.toggle('nw', k === 'network');
  tabs.forEach(function (t) {
    var on = t.getAttribute('data-tab') === k;
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
  });
}
function setHash(h) {
  if (decodeURIComponent(location.hash.slice(1)) !== h) history.replaceState(null, '', '#' + h);
}
function route() {
  var h = decodeURIComponent(location.hash.slice(1));
  var m = /^(findings|network)(?:\/([a-z]+)\/(.+))?$/.exec(h);
  if (!m) { if (!h) select(cur); return; }
  select(m[1]);
  if (m[2]) pin(P[m[1]], m[2] + ':' + m[3], null, 'hash');
  else if (P[m[1]].pin) clear(P[m[1]], false, true);
}

// ---------- graph: click selection and active pathways (SPEC 3.6) ----------
// Pathways of node N: every effect edge downstream of N and every effect edge
// upstream into N (breadth-first, so each edge gets its step count from N),
// gaps that touch N, moderation edges from N or onto an active edge, and
// combination membership. Nothing is added or multiplied along a path.
function related(p, ref) {
  var t = kindOf(ref), id = ref.slice(t.length + 1);
  var R = {keep: {}, far: {}, hop: {}, mem: {}, direct: 0, further: 0, gaps: 0, hid: 0, node: t === 'node'};
  var keep = R.keep;
  function ends(r) { var g = p.g[r]; keep['node:' + g.s] = 1; if (g.t) keep['node:' + g.t] = 1; }
  function add(r) { keep[r] = 1; ends(r); var te = p.g[r].te; if (te) { keep[te] = 1; ends(te); } }
  if (t === 'node') {
    var hop = {}, outs = {}, ins = {}, all = Object.keys(p.g);
    keep[ref] = 1;
    all.forEach(function (r) {
      var g = p.g[r];
      if (g.te || kindOf(r) === 'gap') return;
      (outs[g.s] = outs[g.s] || []).push(r);
      (ins[g.t] = ins[g.t] || []).push(r);
    });
    [[outs, 't'], [ins, 's']].forEach(function (w) {
      var dist = {}, q = [id];
      dist[id] = 0;
      while (q.length) {
        var x = q.shift();
        (w[0][x] || []).forEach(function (r) {
          var d = dist[x] + 1, y = p.g[r][w[1]];
          if (!hop[r] || hop[r] > d) hop[r] = d;
          if (!(y in dist)) { dist[y] = d; q.push(y); }
        });
      }
    });
    all.forEach(function (r) {
      var g = p.g[r];
      if (kindOf(r) === 'gap' && (g.s === id || g.t === id)) hop[r] = 1;
    });
    all.forEach(function (r) {
      var g = p.g[r];
      if (!g.te) return;
      if (g.s === id) { hop[r] = 1; if (!hop[g.te]) hop[g.te] = 2; }
      else if (hop[g.te]) hop[r] = 2;
    });
    Object.keys(hop).forEach(function (r) {
      add(r);
      if (hop[r] > 1) R.far[r] = 1;
      R.hop[r] = hop[r];
      if (!passes(p, r)) R.hid++;
      else if (kindOf(r) === 'gap') R.gaps++;
      else if (hop[r] > 1) R.further++;
      else R.direct++;
    });
    p.mems.forEach(function (m, i) {
      if (m.m === id || m.c === id) { R.mem[i] = 1; keep['node:' + m.m] = 1; keep['node:' + m.c] = 1; }
    });
    return R;
  }
  if (p.g[ref]) { add(ref); return R; }
  if (t === 'paper' && p.docRefs) {
    (p.docRefs[id] || []).forEach(function (r) { if (p.g[r]) { add(r); R.direct++; } });
    return R;
  }
  return null;
}
function highlight(p, ref) {
  var R = ref ? related(p, ref) : null;
  p.svg.classList.toggle('sel', !!R);
  if (p.xsvg) p.xsvg.classList.toggle('sel', !!R);
  p.gEls.forEach(function (n) {
    var r = refOf(n);
    n.classList.toggle('on', !!R && !!R.keep[r]);
    n.classList.toggle('far', !!R && !!R.far[r]);
  });
  p.mems.forEach(function (m, i) { m.el.classList.toggle('on', !!R && !!R.mem[i]); });
  $$('.pin', p.el).forEach(function (n) { n.classList.remove('pin'); });
  if (ref) (p.refs[ref] || []).forEach(function (n) { if (n.closest('svg') || n.closest('.mx')) n.classList.add('pin'); });
  return R;
}
function nameOf(p, ref) {
  var it = p.data && p.data.items[ref], t = kindOf(ref);
  if (t === 'paper') return p.data && p.data.papers[ref.slice(6)] ? p.data.papers[ref.slice(6)][0] : '';
  if (it) return it.ty === 'node' ? it.label : it.ty === 'inter' ? 'Interaction claim' : it.ty === 'gap' ? it.sl + AR + it.tl : lab(it);
  var n = focusable(p, ref);
  return n ? n.getAttribute('aria-label').split(/ \(|: /)[0] : '';
}
// The status line describes the selection in one line. Edges, gaps and nodes are read
// from the graph's own attributes (the pack values), so the text is the same before and
// after the data file loads, and the live region speaks once per selection.
function status(p, R) {
  var ref = p.pin, h, note = '', D = p.data;
  if (!ref) return put(p, HINT);
  var t = kindOf(ref), g = p.g[ref], a = p.attr[ref], it = D && D.items[ref];
  var w = p.k === 'findings' ? ['finding', 'findings'] : ['edge', 'edges'];
  // A unit (a count and its word, a direction, a grade) never breaks across two lines.
  function u(s) { return '<span class="unit">' + s + '</span>'; }
  function n(x, a1, b1) { return u('<span class="n">' + x + '</span> ' + (b1 ? (x === 1 ? a1 : b1) : a1)); }
  function b(s) { return '<b>' + esc(s) + '</b>'; }
  // Separator: a no-break space keeps the dot at the end of a line, not at the start of the next.
  var S = ' · ';
  if (t === 'node' && R) {
    var id = ref.slice(5);
    h = b(p.lbl[id]) + S + KIND[p.kn[id]] + S + 'Pathways: ' + n(R.direct + R.further, w[0], w[1]) + ' (' +
      (R.further ? n(R.direct, 'direct') + ', ' + n(R.further, 'further') : 'all direct') + ')' +
      (R.gaps ? S + n(R.gaps, 'gap', 'gaps') + ' (no evidence)' : '') +
      (R.hid ? S + n(R.hid, 'hidden by filters') : '');
    if (R.further) note = '<p class="pathn">Lighter lines are further steps. ' + PATHN + '</p>';
  } else if (g && t === 'gap') {
    h = b(p.lbl[g.s] + AR + p.lbl[g.t]) + S + '<span class="nev">No evidence</span>' + S + GAPN;
  } else if (g && a) {
    h = (g.te ? b(p.lbl[g.s]) + ' changes the effect of ' + b(p.lbl[p.g[g.te].s] + AR + p.lbl[p.g[g.te].t]) : b(p.lbl[g.s] + AR + p.lbl[g.t])) +
      S + u(dirH(a.dir)) + S + u(certH(a.cert) + ' certainty') + S + n(a.st, 'study', 'studies') + S + n(a.cl, 'claim', 'claims');
  } else if (!D) {
    // A paper or a claim from the URL: write the line when the data file is in.
    return;
  } else if (t === 'paper') {
    var Q = D.papers[ref.slice(6)];
    h = 'Paper: ' + b(Q[0]) + (Q[1] != null ? ' (' + Q[1] + ')' : '') + (R ? S + 'cited by ' + n(R.direct, w[0], w[1]) : '');
  } else if (it && it.ty === 'inter') {
    h = b('Interaction claim') + S + 'one claim, not a pooled finding' + S + 'listed direction ' + u(dirH(it.dir)) + S + 'not drawn in the graph';
  } else {
    h = b(nameOf(p, ref)) + ' (not drawn in the graph)';
  }
  put(p, '<span class="dsc">' + h + '</span>' + note, true);
}
// The text part of the status line is a live region: only rewrite it when it changes.
// The Details and Clear buttons sit outside it and show only with a selection.
function put(p, h, on) {
  var sd = $('.sd', p.stat);
  $('.acts', p.stat).hidden = !on;
  if (sd.getAttribute('data-h') !== h) { sd.innerHTML = h; sd.setAttribute('data-h', h); }
}
function setupGraph(p) {
  function choose(n) {
    var r = refOf(n);
    if (r === p.pin) { clear(p, false); return; }
    pin(p, r, focusable(p, r) || n, 'graph');
  }
  p.svg.addEventListener('click', function (e) {
    var n = e.target.closest(HOOK);
    if (n) choose(n); else if (p.pin) clear(p, false);
  });
  p.svg.addEventListener('keydown', function (e) {
    var n = e.target.closest(HOOK);
    if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(n); }
  });
}

// ---------- drawer ----------
function sdBar(sd) {
  var h = '', t = [];
  DORD.forEach(function (d) {
    var n = sd[d]; if (!n) return;
    h += '<span class="d-' + d + '" style="flex:' + n + '">' + DIR[d][0] + n + '</span>';
    t.push(DIR[d][1] + ' ' + n);
  });
  return '<div class="sdw"><p class="sdl">Study directions</p><div class="sdbar" aria-hidden="true">' + h + '</div><p class="sdt">' + esc(t.join(' · ')) + '</p></div>';
}
function edgeLine(p, ref, from) {
  var it = p.data.items[ref], other = from === it.src ? (it.tgt ? it.tl : 'effect of ' + it.tl) : it.sl;
  if (it.ty === 'gap') return '<span class="muted">No evidence</span>' + AR + esc(other);
  return gl(it.dir) + ' <span class="dots" aria-hidden="true">' + dots(it.cert) + '</span> ' + esc(other);
}
function claimLi(p, c) {
  var C = p.data.claims[c];
  return '<li id="dc-' + p.k + '-' + esc(c.slice(10)) + '"><p class="spo">' + esc(C.s) + ' <span class="pr">→ ' + esc(C.p) + (C.n ? ' (negated)' : '') +
    ' →</span> ' + esc(C.o) + '</p><p class="cm">' + dirH(C.d) + ' · grade ' + CERT[C.g][1] + ' · ' + esc(C.et.map(un).join(', ')) +
    ' · comparator: ' + esc(un(C.c)) + '</p><blockquote>' + esc(C.q) + '</blockquote><p class="cid"><code>' + esc(c) + '</code></p></li>';
}
function byPaper(p, ids, heading) {
  var D = p.data, g = {}, order = [], ix = {};
  ids.forEach(function (c) { var d = D.claims[c].doc; if (!g[d]) { g[d] = []; order.push(d); } g[d].push(c); });
  order.forEach(function (d, i) { ix[d] = i; });
  order.sort(function (a, b) { return g[b].length - g[a].length || ix[a] - ix[b]; });
  return '<h4>' + heading + ' (' + pl(order.length, 'paper', 'papers') + ')</h4>' + order.map(function (d) {
    var P_ = D.papers[d];
    return '<section class="pp"><h5>' + paperT(P_) + '</h5><p class="pm">' + doiH(d, P_[2]) + ' · ' + pl(g[d].length, 'claim', 'claims') +
      '</p><ol class="claims">' + g[d].map(function (c) { return claimLi(p, c); }).join('') + '</ol></section>';
  }).join('');
}
function edgeList(p, title, refs, from) {
  if (!refs.length) return '';
  return '<h4>' + title + ' (' + refs.length + ')</h4><ul class="el">' + refs.map(function (r) {
    var it = p.data.items[r];
    return '<li>' + go(r, edgeLine(p, r, from)) + (it.ty === 'gap' ? '' : ' <span class="muted">' + pl(it.studies, 'study', 'studies') + ', ' + pl(it.claims, 'claim', 'claims') + '</span>') + '</li>';
  }).join('') + '</ul>';
}
function drawerHtml(p, ref) {
  var D = p.data, t = kindOf(ref), id = ref.slice(t.length + 1), it = D.items[ref], h = '', title;
  if (t === 'paper') {
    var P_ = D.papers[id]; if (!P_) return null;
    title = P_[0];
    h = '<p>' + (P_[1] != null ? P_[1] + ' · ' : '') + doiH(id, P_[2]) + '</p>';
    Object.keys(D.items).forEach(function (r) {
      var x = D.items[r], ids = x.ids ? x.ids : (x.ty === 'inter' ? [x.id] : []);
      var mine = ids.filter(function (c) { return D.claims[c].doc === id; });
      if (!mine.length) return;
      h += '<section class="pp"><h4>' + go(r, x.ty === 'inter' ? 'Interaction claim' : esc(lab(x))) + '</h4><ol class="claims">' +
        mine.map(function (c) { return claimLi(p, c); }).join('') + '</ol></section>';
    });
    return {title: title, html: h};
  }
  if (!it) return null;
  if (it.ty === 'finding' || it.ty === 'edge') {
    title = lab(it);
    if (it.kind === 'moderation') h += '<p>Moderation: changes the effect of ' + go('edge:' + it.te, esc(it.tl)) + '.</p><p class="rat">Direction means: ' + esc(it.dm) + '</p>';
    h += '<p class="big">' + dirH(it.dir) + ' · ' + certH(it.cert) + ' certainty</p><p class="rat">' + esc(it.rat) + '</p>';
    h += '<p>' + pl(it.studies, 'study', 'studies') + ' · ' + pl(it.claims, 'claim', 'claims') + '</p>' + sdBar(it.sd);
    h += '<p>From ' + go('node:' + it.src, esc(it.sl)) + (it.tgt ? ' to ' + go('node:' + it.tgt, esc(it.tl)) : '') + '</p>';
    h += byPaper(p, it.ids, 'Claims by paper');
  } else if (it.ty === 'node') {
    title = it.label;
    h = '<p class="muted">' + esc(it.kn ? it.kn + ': ' + it.kt : it.kt) + '</p>';
    if (it.members) h += '<p>Members: ' + it.members.map(function (m) { return go('node:' + m, esc(D.items['node:' + m].label)); }).join(' + ') + '</p>';
    if (it.kind === 'condition') h += '<p class="note">' + esc(D.pathNote) + '</p>';
    h += edgeList(p, 'Edges in', it.ins, it.id) + edgeList(p, 'Edges out', it.outs, it.id);
  } else if (it.ty === 'gap') {
    title = it.sl + AR + it.tl;
    h = '<p class="big"><b>No evidence</b></p><p>' + esc(D.gapNote) + '</p><p class="rat">Searched for: ' + esc(it.sf) + '</p>' +
      '<p>From ' + go('node:' + it.src, esc(it.sl)) + ' to ' + go('node:' + it.tgt, esc(it.tl)) + '</p>';
  } else if (it.ty === 'inter') {
    var C = D.claims[it.id], Q = D.papers[C.doc];
    title = 'Interaction claim';
    h = '<p>One claim, not a pooled finding. Listed direction: ' + dirH(it.dir) + '</p><ol class="claims">' + claimLi(p, it.id) + '</ol>' +
      '<p class="pm">' + paperT(Q) + ' · ' + doiH(C.doc, Q[2]) + '</p>';
  }
  return {title: title, html: h};
}
function apply(p) { status(p, highlight(p, p.pin)); }
// Move focus to the drawer and scroll so it (or the claim to show) starts at the top.
// On wide screens the stage comes into view, so the graph highlight and the drawer show together.
function toDrawer(p, target) {
  $('h3', p.drawer).focus({preventScroll: true});
  // In the expanded view the drawer is its own column: never scroll the page behind it.
  if (p.xopen) { if (target) target.scrollIntoView({block: 'center'}); return; }
  (target || (wide.matches ? $('.stage', p.el) : p.drawer)).scrollIntoView({block: target ? 'center' : 'start'});
}
// Select an item: highlight it in the graph, show it in the drawer, record it in the hash.
// how: 'graph' (click or key in the graph), 'hash' (from the URL), or undefined (tables, drawer, search).
function pin(p, ref, opener, how) {
  if (opener && !p.drawer.contains(opener)) p.opener = opener;
  if (p.sres) p.sres.hidden = true;
  if (kindOf(ref) !== 'claim') { p.pin = ref; apply(p); }
  load(p).then(function () {
    var focusClaim = null;
    if (kindOf(ref) === 'claim') { focusClaim = ref.slice(6); ref = p.owner[focusClaim] || ref; }
    var r = drawerHtml(p, ref);
    if (!r) { if (p.pin === ref) clear(p, false, true); return; }
    p.pin = ref; apply(p);
    $('h3', p.drawer).textContent = r.title;
    $('.dr-body', p.drawer).innerHTML = r.html;
    p.drawer.classList.add('open');
    if (how !== 'hash') setHash(p.k + '/' + ref.replace(':', '/'));
    var target = focusClaim && doc.getElementById('dc-' + p.k + '-' + focusClaim.slice(10));
    if (target) target.classList.add('flash');
    if (wide.matches) p.drawer.scrollTop = 0;
    if (how === 'hash') return;
    // Keep the highlighted graph in view when a node is chosen on a narrow screen:
    // its details are under the graph, one "Details below" click away.
    if (how === 'graph' && !wide.matches && kindOf(ref) === 'node') return;
    // Beside the graph (wide), a graph click needs no scroll; otherwise bring the drawer into view.
    if (how === 'graph' && wide.matches) $('h3', p.drawer).focus({preventScroll: true});
    else toDrawer(p, target);
  }, function () {
    $('.dr-body', p.drawer).innerHTML = '<p>Could not load the claims file. Open the <a href="' + (p.k === 'findings' ? 'claims-findings.html' : 'claims-network.html') + '">claims page</a> instead.</p>';
    p.drawer.classList.add('open');
  });
}
function clear(p, refocus, fromHash) {
  var ref = p.pin;
  p.pin = null; apply(p);
  p.drawer.classList.remove('open');
  $('h3', p.drawer).textContent = 'Details';
  $('.dr-body', p.drawer).innerHTML = '<p class="muted">' + EMPTY + '</p>';
  if (!fromHash) setHash(p.k);
  if (!refocus) return;
  var o = p.opener;
  if (o && o.isConnected && o.getClientRects().length) o.focus();
  else if (ref && focusable(p, ref)) focusable(p, ref).focus();
}

// ---------- filters, lens, search ----------
function passes(p, ref) {
  var a = p.attr[ref];
  if (!a) return true;
  if (a.gap) return p.f.gaps;
  return p.f.dirs.indexOf(a.dir) >= 0 && CERT[a.cert][0] >= p.f.min;
}
function inLens(p, ref) {
  var g = p.g[ref];
  if (p.lens === 'all' || !g) return true;
  var ks = p.kind[g.s], kt = g.t ? p.kind[g.t] : null;
  if (p.lens === 'direct') return (ks === 'planting_stock' || ks === 'site_treatment') && kt === 'outcome';
  if (p.lens === 'via') return ks === 'condition' || kt === 'condition';
  return !!g.te || ks === 'combination';
}
function refresh(p) {
  var shown = 0, total = 0, lensN = {}, hitN = {};
  Object.keys(p.refs).forEach(function (r) {
    var t = kindOf(r);
    if (t === 'node' || t === 'paper') return;
    var ok = passes(p, r), inl = inLens(p, r), hit = !p.hits || !!p.hits[r], g = p.g[r];
    if (t === 'finding' || t === 'edge') { total++; if (ok && hit) shown++; }
    if (g && inl) { lensN[g.s] = 1; if (g.t) lensN[g.t] = 1; }
    if (g && p.hits && p.hits[r]) { hitN[g.s] = 1; if (g.t) hitN[g.t] = 1; }
    p.refs[r].forEach(function (n) {
      if (n.closest('svg') || n.closest('.mx')) {
        n.classList.toggle('off', !ok); n.classList.toggle('lo', !inl); n.classList.toggle('miss', !hit);
        if (n.hasAttribute('tabindex')) n.setAttribute('tabindex', ok ? '0' : '-1');
      }
      // tables (switched off): hide table rows that the filters or the search remove.
      // else if (n.tagName === 'TR') n.classList.toggle('fx', !(ok && hit));
    });
  });
  p.nodes.forEach(function (n) {
    var id = refOf(n).slice(5);
    n.classList.toggle('lo', p.lens !== 'all' && !lensN[id]);
    n.classList.toggle('miss', !!p.hits && !p.hits['node:' + id] && !hitN[id]);
  });
  /* tables (switched off): Papers table rows
  if (p.docRefs) $$('tr[data-doc]', p.el).forEach(function (tr) {
    var d = tr.getAttribute('data-doc');
    var ok = (p.docRefs[d] || []).some(function (r) { return kindOf(r) === 'inter' || passes(p, r); });
    tr.classList.toggle('fx', !(ok && (!p.hits || p.docHit[d])));
  });
  */
  p.count.textContent = 'Showing ' + shown + ' of ' + total + ' ' + (p.k === 'findings' ? 'findings' : 'edges') +
    (p.f.gaps ? '' : ', gaps hidden') + (p.lens !== 'all' ? ', lens: ' + $('[data-lens="' + p.lens + '"]', p.el).textContent : '');
  // tables (switched off): paging and the Claims table
  // pageTables(p);
  // if (p.claimsOpen) renderClaims(p);
  apply(p);
}
function search(p, q) {
  q = q.trim().toLowerCase(); p.q = q;
  if (!q) { p.hits = null; p.sres.hidden = true; refresh(p); return; }
  load(p).then(function (D) {
    if (p.q !== q) return;
    var m = function (s) { return s != null && String(s).toLowerCase().indexOf(q) >= 0; };
    var hits = {}, docHit = {}, claimHit = {}, res = {n: [], e: [], p: [], c: []};
    Object.keys(D.papers).forEach(function (d) { if (m(D.papers[d][0]) || m(d)) { docHit[d] = 1; res.p.push(d); } });
    Object.keys(D.claims).forEach(function (c) {
      var C = D.claims[c];
      if (m(C.s) || m(C.o) || m(C.q)) { claimHit[c] = 1; res.c.push(c); docHit[C.doc] = docHit[C.doc] || 2; }
    });
    Object.keys(D.items).forEach(function (r) {
      var it = D.items[r];
      if (it.ty === 'node') { if (m(it.label)) { hits[r] = 1; res.n.push(r); } return; }
      if (it.ty === 'inter') { if (claimHit[it.id] || docHit[D.claims[it.id].doc] === 1) hits[r] = 1; return; }
      var h = m(it.sl) || m(it.tl);
      if (!h && it.ids) h = it.ids.some(function (c) { return claimHit[c] || docHit[D.claims[c].doc] === 1; });
      if (h) { hits[r] = 1; res.e.push(r); }
    });
    p.hits = hits; p.docHit = docHit; p.claimHit = claimHit;
    var total = res.n.length + res.e.length + res.p.length + res.c.length;
    function grp(name, list, f) {
      if (!list.length) return '';
      return '<h4>' + name + ' (' + list.length + ')</h4><ul>' + list.slice(0, 6).map(function (x) { return '<li>' + f(x) + '</li>'; }).join('') +
        '</ul>' + (list.length > 6 ? '<p class="rc">+' + (list.length - 6) + ' more</p>' : '');
    }
    p.sres.innerHTML = '<p class="rc">' + pl(total, 'result', 'results') + ' for “' + esc(q) + '”</p>' +
      grp('Nodes', res.n, function (r) { return go(r, esc(D.items[r].label)); }) +
      grp(p.k === 'findings' ? 'Findings' : 'Edges', res.e, function (r) {
        var it = D.items[r];
        return go(r, it.ty === 'gap' ? esc(it.sl + AR + it.tl) + ' (no evidence)' : gl(it.dir) + ' ' + esc(lab(it)));
      }) +
      grp('Papers', res.p, function (d) { return go('paper:' + d, paperT(D.papers[d])); }) +
      grp('Claims', res.c, function (c) { var C = D.claims[c]; return go('claim:' + c, esc(C.s + AR + C.o)); });
    p.sres.hidden = false;
    refresh(p);
  }, function () {});
}
/* tables (switched off): the Claims and Papers tables, sorting and "Show all" buttons.
function renderClaims(p) {
  var host = $('.cl-host', p.el), D = p.data;
  if (!D) return;
  var rows = Object.keys(D.claims).filter(function (c) {
    var C = D.claims[c];
    return p.f.dirs.indexOf(C.d) >= 0 && CERT[C.g][0] >= p.f.min && (!p.hits || p.claimHit[c]);
  });
  var all = host.getAttribute('data-all') === '1', show = all ? rows : rows.slice(0, 25);
  host.innerHTML = '<table class="tbl" id="tbl-claims-' + p.k + '"><caption>Claims: ' + rows.length + ' of ' + Object.keys(D.claims).length +
    ' match the filters and search. Select a row to open it with its ' + (p.k === 'findings' ? 'finding' : 'edge') + '.</caption>' +
    '<thead><tr><th scope="col">Claim</th><th scope="col">Direction</th><th scope="col">Grade</th><th scope="col">Quote</th><th scope="col">Paper</th></tr></thead><tbody>' +
    show.map(function (c) {
      var C = D.claims[c], Q = D.papers[C.doc];
      return '<tr data-ref="claim:' + esc(c) + '"><th scope="row" data-label="Claim">' + go('claim:' + c, esc(C.s + AR + C.o)) + ' <span class="mono small">' + esc(c) + '</span></th>' +
        '<td data-label="Direction">' + dirH(C.d) + '</td><td data-label="Grade">' + CERT[C.g][1] + '</td><td data-label="Quote"><blockquote>' + esc(C.q) +
        '</blockquote></td><td data-label="Paper">' + paperT(Q) + '<br>' + doiH(C.doc, Q[2]) + '</td></tr>';
    }).join('') + '</tbody></table>' +
    (rows.length > 25 ? '<button type="button" class="more2">' + (all ? 'Show first 25' : 'Show all ' + rows.length) + '</button>' : '');
}
function renderPapers(p) {
  var host = $('.pp-host', p.el), D = p.data;
  if (!D || host.firstChild) return;
  var n = {};
  Object.keys(D.claims).forEach(function (c) { var d = D.claims[c].doc; n[d] = (n[d] || 0) + 1; });
  var docs = Object.keys(D.papers).sort(function (a, b) {
    var x = D.papers[a][0].toLowerCase(), y = D.papers[b][0].toLowerCase();
    return n[b] - n[a] || (x < y ? -1 : x > y ? 1 : 0);
  });
  host.innerHTML = '<table class="tbl sortable tp"><caption>Papers: one row per document behind this panel. Select a row to read its claims.</caption><thead><tr>' +
    '<th scope="col"><button type="button" data-k="0">Paper</button></th><th scope="col" class="num"><button type="button" data-k="1">Year</button></th>' +
    '<th scope="col">DOI or id</th><th scope="col" class="num"><button type="button" data-k="3">Claims</button></th><th scope="col">Cited by</th></tr></thead><tbody>' +
    docs.map(function (d) {
      var Q = D.papers[d];
      return '<tr data-doc="' + esc(d) + '"><th scope="row">' + go('paper:' + d, esc(Q[0])) + '</th><td class="num">' + (Q[1] == null ? '' : Q[1]) +
        '</td><td>' + doiH(d, Q[2]) + '</td><td class="num">' + n[d] + '</td><td><ul class="cl">' + (p.docRefs[d] || []).map(function (r) {
          var it = D.items[r];
          return '<li>' + go(r, it.ty === 'inter' ? 'Interaction claim ' + esc(it.id) : esc(lab(it))) + '</li>';
        }).join('') + '</ul></td></tr>';
    }).join('') + '</tbody></table><button type="button" class="more" hidden></button>';
  sortable(p, $('table', host));
  moreBtn(p, $('.more', host));
  refresh(p);
}
function sortable(p, t) {
  $$('th button', t).forEach(function (b) { b.addEventListener('click', function () { sortBy(p, t, b); }); });
}
function moreBtn(p, b) {
  b.addEventListener('click', function () {
    var t = b.previousElementSibling;
    t.setAttribute('data-all', t.getAttribute('data-all') === '1' ? '' : '1');
    pageTables(p);
  });
}
*/
function renderMatrix(p) {
  var D = p.data, box = $('.mbox', p.el);
  if (box.firstChild) return;
  var rows = [], cols = [], cell = {}, order = {}, i = 0;
  Object.keys(D.items).forEach(function (r) { if (D.items[r].ty === 'node') order[D.items[r].id] = i++; });
  Object.keys(D.items).forEach(function (r) {
    var it = D.items[r];
    if (it.ty !== 'finding' && it.ty !== 'edge' && it.ty !== 'gap') return;
    var c = it.tgt || 'te:' + it.te;
    if (rows.indexOf(it.src) < 0) rows.push(it.src);
    if (cols.indexOf(c) < 0) cols.push(c);
    cell[it.src + '|' + c] = r;
  });
  function te(c) { return c.indexOf('te:') === 0; }
  rows.sort(function (a, b) { return order[a] - order[b]; });
  cols.sort(function (a, b) { return (te(a) - te(b)) || (te(a) ? 0 : order[a] - order[b]); });
  var h = '<table class="mx"><caption>Matrix: rows are sources, columns are targets. One cell is one ' + (p.k === 'findings' ? 'finding' : 'edge') +
    '. A blank cell: no claims in this corpus link the two.</caption><thead><tr><td></td>' + cols.map(function (c) {
      return '<th scope="col">' + esc(te(c) ? 'Effect of ' + lab(D.items['edge:' + c.slice(3)]) : D.items['node:' + c].label) + '</th>';
    }).join('') + '</tr></thead><tbody>';
  rows.forEach(function (s) {
    h += '<tr><th scope="row">' + esc(D.items['node:' + s].label) + '</th>';
    cols.forEach(function (c) {
      var r = cell[s + '|' + c], it = r && D.items[r];
      if (!it) h += '<td class="empty" title="No claims in this corpus link these two"></td>';
      else if (it.ty === 'gap') h += '<td class="gapc"><button type="button" data-go="' + esc(r) + '" aria-label="' + esc(aria(it)) + '">No evidence</button></td>';
      else h += '<td><button type="button" class="mc d-' + it.dir + '" data-go="' + esc(r) + '" aria-label="' + esc(aria(it)) + '"><span class="gl" aria-hidden="true">' +
        DIR[it.dir][0] + '</span><span class="dots" aria-hidden="true">' + dots(it.cert) + '</span></button></td>';
    });
    h += '</tr>';
  });
  box.innerHTML = h + '</tbody></table>';
  index(p, $$('[data-go]', box));
  refresh(p);
}
/* tables (switched off): paging (25 rows, then "Show all") and column sorting.
function pageTables(p) {
  $$('.more', p.el).forEach(function (b) {
    var t = b.previousElementSibling, all = t.getAttribute('data-all') === '1';
    var vis = $$('tbody > tr', t).filter(function (r) { return !r.classList.contains('fx'); });
    $$('tbody > tr', t).forEach(function (r) { r.classList.remove('pg'); });
    vis.forEach(function (r, i) { r.classList.toggle('pg', !all && i >= 25); });
    b.hidden = vis.length <= 25;
    b.textContent = all ? 'Show first 25' : 'Show all ' + vis.length;
  });
}
function sortBy(p, t, b) {
  var th = b.parentNode, k = +b.getAttribute('data-k'), asc = th.getAttribute('aria-sort') !== 'ascending';
  $$('th[aria-sort]', t).forEach(function (x) { x.removeAttribute('aria-sort'); });
  th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
  var tb = t.tBodies[0], rows = $$('tbody > tr', t);
  function val(r) {
    var c = r.cells[k], v = c.getAttribute('data-v');
    if (v == null && c.classList.contains('num')) v = c.textContent || '0';
    return v != null ? +v : c.textContent.trim().toLowerCase();
  }
  rows.sort(function (x, y) { var a = val(x), z = val(y); return (a < z ? -1 : a > z ? 1 : 0) * (asc ? 1 : -1); });
  rows.forEach(function (r) { tb.appendChild(r); });
  pageTables(p);
}
*/

// ---------- setup ----------
function setup(el) {
  var k = el.getAttribute('data-panel');
  var p = P[k] = {k: k, el: el, svg: $('svg.graph', el), drawer: $('.drawer', el), stat: $('.selbar', el), refs: {}, g: {}, kind: {}, attr: {}, lbl: {}, kn: {},
    f: {dirs: DORD.slice(), min: 0, gaps: true}, lens: 'all', q: '', hits: null, pin: null};
  index(p, $$(HOOK, el));
  p.gEls = $$(HOOK, p.svg);
  p.nodes = $$('.nd', p.svg);
  p.mems = $$('.mem', p.svg).map(function (n) { return {el: n, m: n.getAttribute('data-m'), c: n.getAttribute('data-c')}; });
  p.gEls.concat(p.mems.map(function (m) { return m.el; })).forEach(function (n) { n.classList.add('it'); });
  $$('.ln', p.svg).forEach(function (n) {
    p.g[refOf(n)] = {s: n.getAttribute('data-s'), t: n.getAttribute('data-t'), te: n.getAttribute('data-te')};
  });
  // Label and kind of each node, and the pack values of each chip, for the status line.
  p.nodes.forEach(function (n) {
    var id = refOf(n).slice(5), kd = n.getAttribute('data-kind');
    p.kind[id] = kd;
    p.lbl[id] = n.getAttribute('data-label');
    p.kn[id] = kd || (n.classList.contains('k-outcome') ? 'outcome' : 'factor');
  });
  $$('.chip', p.svg).forEach(function (n) {
    p.attr[refOf(n)] = {dir: n.getAttribute('data-direction'), cert: n.getAttribute('data-certainty'),
      st: +n.getAttribute('data-studies'), cl: +n.getAttribute('data-claims')};
  });
  $$('.gapl', p.svg).forEach(function (n) { p.attr[refOf(n)] = {gap: 1}; });
  setupGraph(p);

  var xb = $('.xbtn', el);
  if (xb) xb.addEventListener('click', function () { explore(p, xb); });
  // Copy image and data export: each module loads on its first click (see need()).
  $$('[data-act]', el).forEach(function (b) {
    // Load snap.js before the first click, so Safari keeps the clipboard write inside that click.
    if (b.getAttribute('data-act') === 'copy') ['pointerenter', 'focus'].forEach(function (t) {
      b.addEventListener(t, function () { need('snap').catch(function () {}); });
    });
    b.addEventListener('click', function () {
      var a = b.getAttribute('data-act');
      if (a === 'copy') need('snap').then(function () { window.Q1Snap.copy(p, b); }, function () {});
      else need('export').then(function () { window.Q1Export.run(p, a, b); }, function () {});
    });
  });

  var tb = $('.toolbar', el);
  p.count = $('.count', tb); p.sres = $('.sres', tb); p.qi = $('input[type=search]', tb);
  $$('.fchip', tb).forEach(function (b) {
    b.addEventListener('click', function () {
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      p.f.dirs = $$('.fchip', tb).filter(function (x) { return x.getAttribute('aria-pressed') === 'true'; }).map(function (x) { return x.getAttribute('data-dir'); });
      refresh(p);
    });
  });
  $('select[data-min]', tb).addEventListener('change', function () { p.f.min = +this.value; refresh(p); });
  $('input[data-gaps]', tb).addEventListener('change', function () { p.f.gaps = this.checked; refresh(p); });
  $$('[data-lens]', tb).forEach(function (b) {
    b.addEventListener('click', function () {
      p.lens = b.getAttribute('data-lens');
      $$('[data-lens]', tb).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      refresh(p);
    });
  });
  var timer;
  p.qi.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { search(p, p.qi.value); }, 140); });
  p.qi.addEventListener('focus', function () { load(p).catch(function () {}); if (p.q) p.sres.hidden = false; });
  p.qi.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); if (p.qi.value) { p.qi.value = ''; search(p, ''); } else p.sres.hidden = true; }
  });
  doc.addEventListener('click', function (e) { if (!e.target.closest('.srch')) p.sres.hidden = true; });

  $$('[data-view]', el).forEach(function (b) {
    b.addEventListener('click', function () {
      var mx = b.getAttribute('data-view') === 'matrix';
      $('.viz', el).classList.toggle('mxon', mx);
      $$('[data-view]', el).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      if (mx) load(p).then(function () { renderMatrix(p); }, function () {});
    });
  });
  el.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('svg.graph')) return;
    if (t.closest('.clr')) { clear(p, true); return; }
    if (t.closest('.tod')) { toDrawer(p); return; }
    var a = t.closest('a[data-ref], [data-go]');
    if (a) { e.preventDefault(); pin(p, refOf(a), a); return; }
    if (t.closest('.x')) { clear(p, true); return; }
    /* tables (switched off): "Show all" in the Claims table, and a click on a table row selects its item.
    if (t.closest('.more2')) { var h = $('.cl-host', el); h.setAttribute('data-all', h.getAttribute('data-all') === '1' ? '' : '1'); renderClaims(p); return; }
    var tr = t.closest('tr'), r = tr && (tr.getAttribute('data-doc') ? 'paper:' + tr.getAttribute('data-doc') : refOf(tr));
    if (r && !t.closest('a[href^="https:"], button, summary')) { e.preventDefault(); pin(p, r, $('a', tr) || tr); }
    */
  });
  /* tables (switched off): sorting, "Show all" and the Claims and Papers sections that build on open.
  $$('table.sortable', el).forEach(function (t) { sortable(p, t); });
  $$('.more', el).forEach(function (b) { moreBtn(p, b); });
  var cd = $('details.claims', el), pd = $('details.papers', el);
  cd.addEventListener('toggle', function () {
    p.claimsOpen = cd.open;
    if (cd.open) load(p).then(function () { renderClaims(p); }, function () {});
  });
  pd.addEventListener('toggle', function () { if (pd.open) load(p).then(function () { renderPapers(p); }, function () {}); });
  */
  refresh(p);
}

// ---------- modules loaded on first use ----------
// need('snap') loads snap.js once; need('explore', true) loads explore.js and explore.css together.
var loaded = {};
function need(name, css) {
  if (!loaded[name]) loaded[name] = Promise.all([['script', 'src', name + '.js']].concat(css ? [['link', 'href', name + '.css']] : []).map(function (f) {
    return new Promise(function (ok, no) {
      var e = doc.createElement(f[0]);
      if (f[0] === 'link') e.rel = 'stylesheet';
      e[f[1]] = f[2];
      e.onload = ok; e.onerror = no;
      doc.head.appendChild(e);
    });
  })).catch(function (e) { loaded[name] = null; throw e; });
  return loaded[name];
}
// ---------- expanded view (explore.js) ----------
function explore(p, btn) { need('explore', true).then(function () { window.Q1X.open(p, btn); }, function () {}); }
// Shared with the modules that load later (explore.js, snap.js, export.js).
window.Q1 = {pin: pin, clear: clear, refresh: refresh, index: index, refOf: refOf, DIR: DIR, CERT: CERT, DORD: DORD, wide: wide,
  P: P, load: load, related: related, passes: passes, inLens: inLens, kindOf: kindOf, lab: lab, nameOf: nameOf};

$$('[data-panel]').forEach(setup);
var tl = $('.cards');
tl.setAttribute('role', 'tablist');
tl.setAttribute('aria-label', 'Panels');
tabs.forEach(function (t, i) {
  var k = t.getAttribute('data-tab'), panel = P[k].el;
  t.setAttribute('role', 'tab');
  t.setAttribute('aria-controls', panel.id);
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', t.id);
  t.addEventListener('click', function (e) { e.preventDefault(); select(k); setHash(k); });
  t.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    var j = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    tabs[j].focus(); tabs[j].click();
  });
});
doc.addEventListener('keydown', function (e) {
  var p = P[cur], tag = (doc.activeElement && doc.activeElement.tagName) || '';
  if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(tag)) { e.preventDefault(); p.qi.focus(); }
  else if (e.key === 'Escape') {
    if (!p.sres.hidden) p.sres.hidden = true;
    else if (p.pin) clear(p, true);
  }
});

// ---------- toolbar dock (experiment) ----------
// The toolbar stays in view while the panel scrolls (CSS section "toolbar dock").
// The view bar with the status line sticks under it while the graph is in view.
// This block adds a switch to each toolbar: top, bottom, left or right. The choice is
// <html data-dock> (DOCK_JS in build.py sets it before the first paint) and
// localStorage "q1-dock". Left and right need 1100 px; below that the CSS shows the
// toolbar at the top and the switch hides those two buttons. The search results use
// fixed positioning, and place() puts them beside the search box (or beside the column).
// To remove the experiment: delete this block, DOCK_JS and the CSS section.
(function () {
  var DK = [['top', 'Toolbar at the top', 'x="4" y="4" width="8" height="2.6"'],
    ['bottom', 'Toolbar at the bottom', 'x="4" y="9.4" width="8" height="2.6"'],
    ['left', 'Toolbar on the left', 'x="4" y="4" width="2.6" height="8"'],
    ['right', 'Toolbar on the right', 'x="9.4" y="4" width="2.6" height="8"']];
  var side = matchMedia('(min-width: 1100px)');
  function stored() { var d = root.getAttribute('data-dock'); return /^(top|bottom|left|right)$/.test(d) ? d : 'top'; }
  function eff() { var d = stored(); return (d === 'left' || d === 'right') && !side.matches ? 'top' : d; }
  var bars = $$('.toolbar'), lists = $$('.toolbar .sres');
  bars.forEach(function (tb) {
    var g = doc.createElement('div');
    g.className = 'seg dock';
    g.setAttribute('role', 'group');
    g.innerHTML = DK.map(function (d) {
      return '<button type="button" data-dock="' + d[0] + '" aria-pressed="false" aria-label="' + d[1] + '" title="' + d[1] + '">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="2.5"/><rect class="f" ' + d[2] + ' rx=".6"/></svg></button>';
    }).join('');
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      root.setAttribute('data-dock', b.getAttribute('data-dock'));
      try { localStorage.setItem('q1-dock', b.getAttribute('data-dock')); } catch (x) {}
      sync();
    });
    // First row, at the right end: after the search box (and the lens), before the filters.
    tb.insertBefore(g, $('.filters', tb));
  });
  function sync() {
    var e = eff();
    $$('.dock').forEach(function (g) {
      g.setAttribute('aria-label', 'Toolbar position: ' + e);
      $$('button', g).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-dock') === e ? 'true' : 'false'); });
    });
    measure();
    lists.forEach(place);
  }
  // --dockh: the height of the visible top or bottom bar (0 for a side column), for scroll-margin.
  function measure() {
    var h = 0, e = eff();
    if (e === 'top' || e === 'bottom') bars.forEach(function (tb) { h = Math.max(h, tb.offsetHeight); });
    root.style.setProperty('--dockh', h + 'px');
  }
  // Keyboard focus is never hidden under a top or bottom bar, or under the pinned view bar:
  // scroll by the overlap.
  doc.addEventListener('focusin', function (ev) {
    var n = ev.target, e = eff(), el = P[cur].el, tb = $('.toolbar', el), vb = $('.vbar', el), fv = true;
    try { fv = n.matches(':focus-visible'); } catch (x) {}
    if (!tb || tb.contains(n) || (vb && vb.contains(n)) || !fv || root.classList.contains('xvopen')) return;
    setTimeout(function () {
      var r = n.getBoundingClientRect(), t = tb.getBoundingClientRect(), up = 0, hid = false;
      var over = r.bottom > t.top && r.top < t.bottom;
      if (e === 'bottom' && over) { scrollBy(0, r.bottom - t.top + 16); return; }
      if (e === 'top') { up = t.bottom; hid = over; }
      // The view bar can cover only what comes after it in its own column (graph, matrix, actions).
      // Below 1100 px only its status line sticks (the bar itself has no box then).
      if (vb && vb.parentNode.contains(n)) {
        var sb = $('.selbar', vb), v = Math.max(vb.getBoundingClientRect().bottom, sb ? sb.getBoundingClientRect().bottom : 0);
        up = Math.max(up, v); hid = hid || r.top < v;
      }
      if (hid) scrollBy(0, r.top - up - 16);
    }, 0);
  });
  // Put the open results list under or over the search box, or beside a side column, inside the viewport.
  function place(s) {
    if (s.hidden) return;
    var tb = s.closest('.toolbar'), r = $('input', tb).getBoundingClientRect(), t = tb.getBoundingClientRect();
    var W = root.clientWidth, H = innerHeight, m = 8, w = Math.min(560, W - 2 * m), st = s.style, h;
    st.top = st.bottom = 'auto';
    if (getComputedStyle(tb).flexDirection === 'column') {
      var lft = t.left < W / 2;
      w = Math.min(w, (lft ? W - t.right : t.left) - 2 * m);
      st.left = (lft ? t.right + m : t.left - m - w) + 'px';
      var y = Math.max(m, Math.min(r.top, H - m - 360));
      st.top = y + 'px'; h = H - y - m;
    } else {
      st.left = Math.max(m, Math.min(r.left, W - m - w)) + 'px';
      var below = H - r.bottom - m - 6, above = r.top - m - 6;
      if (below >= 260 || below >= above) { st.top = (r.bottom + 6) + 'px'; h = below; }
      else { st.bottom = (H - r.top + 6) + 'px'; h = above; }
    }
    st.width = w + 'px';
    st.maxHeight = Math.max(140, Math.min(h, H * 0.7)) + 'px';
  }
  if (window.MutationObserver) lists.forEach(function (s) {
    new MutationObserver(function () { place(s); }).observe(s, {attributes: true, attributeFilter: ['hidden'], childList: true});
  });
  if (window.ResizeObserver) { var ro = new ResizeObserver(measure); bars.forEach(function (tb) { ro.observe(tb); }); }
  function again() { lists.forEach(place); }
  addEventListener('scroll', again, {passive: true, capture: true});
  addEventListener('resize', function () { measure(); again(); });
  if (side.addEventListener) side.addEventListener('change', sync);
  sync();
})();

addEventListener('hashchange', route);
route();
})();
