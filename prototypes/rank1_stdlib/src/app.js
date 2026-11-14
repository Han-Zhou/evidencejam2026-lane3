// Q1 prototype, rank 1. Vanilla JS, no framework, no external requests.
// The page works without this file. It adds tabs, hover cards, the drawer,
// search, lenses, filters, the matrix toggle, sorting and paging.
(function () {
'use strict';
var doc = document, root = doc.documentElement;
var DIR = {increase: ['↑', 'Increase'], decrease: ['↓', 'Decrease'], mixed: ['↕', 'Mixed (studies disagree)'],
  no_effect: ['=', 'No effect (tested)'], unclear: ['?', 'Unclear']};
var DORD = ['increase', 'decrease', 'mixed', 'no_effect', 'unclear'];
var CERT = {high: [4, 'High'], moderate: [3, 'Moderate'], low: [2, 'Low'], very_low: [1, 'Very low']};
var AR = ' → ';
var P = {}, cur = 'findings', hov = null;
var hc = doc.getElementById('hc');

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
var GAPN = 'No study in this corpus tested this pairing. This is a gap, not a negative result.';

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
  hideCard();
}
function setHash(h) {
  if (decodeURIComponent(location.hash.slice(1)) !== h) history.replaceState(null, '', '#' + h);
}
function route() {
  var h = decodeURIComponent(location.hash.slice(1));
  var m = /^(findings|network)(?:\/([a-z]+)\/(.+))?$/.exec(h);
  if (!m) { if (!h) select(cur); return; }
  select(m[1]);
  if (m[2]) pin(P[m[1]], m[2] + ':' + m[3], null, true);
  else if (P[m[1]].pin) closeDrawer(P[m[1]], true);
}

// ---------- hover card ----------
function hideCard() { hov = null; hc.hidden = true; }
function placeCard(x, y) {
  var w = hc.offsetWidth, h = hc.offsetHeight, L = x + 16, T = y + 16;
  if (L + w > innerWidth - 8) L = Math.max(8, x - w - 16);
  if (T + h > innerHeight - 8) T = Math.max(8, y - h - 16);
  hc.style.left = L + 'px'; hc.style.top = T + 'px';
}
function showCard(p, ref, x, y, el) {
  hov = {p: p, ref: ref, x: x, y: y};
  hc.innerHTML = p.data ? card(p, ref) : '<p>' + esc(el.getAttribute('aria-label')) + '</p>';
  hc.hidden = false; placeCard(x, y);
  if (!p.data) load(p).then(function () {
    if (hov && hov.ref === ref) { hc.innerHTML = card(p, ref); placeCard(hov.x, hov.y); }
  }, function () {});
}
function topPapers(p, it, n) {
  var c = {}, order = [];
  it.ids.forEach(function (id) { var d = p.data.claims[id].doc; if (!c[d]) { c[d] = 0; order.push(d); } c[d]++; });
  var ix = {}; order.forEach(function (d, i) { ix[d] = i; });
  order.sort(function (a, b) { return c[b] - c[a] || ix[a] - ix[b]; });
  var h = order.slice(0, n).map(function (d) { return '<li>' + paperT(p.data.papers[d]) + '</li>'; }).join('');
  return '<ul>' + h + '</ul>' + (order.length > n ? '<p>+' + (order.length - n) + ' more</p>' : '');
}
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
function card(p, ref) {
  var D = p.data, it = D.items[ref];
  if (!it) return '';
  var h = '';
  if (it.ty === 'finding' || it.ty === 'edge') {
    h = '<h4>' + esc(lab(it)) + '</h4>';
    if (it.kind === 'moderation') h += '<p>Changes the effect of ' + esc(it.tl) + '.</p><p class="muted">' + esc(it.dm) + '</p>';
    h += '<p>' + dirH(it.dir) + ' · ' + certH(it.cert) + ' certainty</p><p class="muted">' + esc(it.rat) + '</p>';
    h += '<p>' + pl(it.studies, 'study', 'studies') + ' · ' + pl(it.claims, 'claim', 'claims') + '</p>' + sdBar(it.sd);
    h += topPapers(p, it, 3) + '<p class="ft">Click to pin and read the quotes</p>';
  } else if (it.ty === 'node') {
    h = '<h4>' + esc(it.label) + '</h4><p class="muted">' + esc(it.kn ? it.kn + ': ' + it.kt : it.kt) + '</p>';
    if (it.members) h += '<p>Members: ' + it.members.map(function (m) { return esc(D.items['node:' + m].label); }).join(' + ') + '</p>';
    h += '<p>' + pl(it.ins.length, 'edge in', 'edges in') + ' · ' + pl(it.outs.length, 'edge out', 'edges out') + '</p><ul>';
    it.ins.forEach(function (r) { h += '<li>in: ' + edgeLine(p, r, it.id) + '</li>'; });
    it.outs.forEach(function (r) { h += '<li>out: ' + edgeLine(p, r, it.id) + '</li>'; });
    h += '</ul>';
    if (it.kind === 'condition') h += '<p class="muted">Glow: clay = edges into this condition, dark = edges out of it. ' + esc(D.pathNote) + '</p>';
    h += '<p class="ft">Click to pin</p>';
  } else if (it.ty === 'gap') {
    h = '<h4>' + esc(it.sl + AR + it.tl) + '</h4><p><b>No evidence.</b> ' + esc(D.gapNote) + '</p><p class="muted">Searched for: ' + esc(it.sf) + '</p>';
  }
  return h;
}

// ---------- graph: highlight, hover, pin ----------
function related(p, ref) {
  var keep = {}, inn = {}, out = {}, t = ref.split(':')[0], id = ref.slice(t.length + 1);
  keep[ref] = 1;
  if (t === 'node') {
    Object.keys(p.g).forEach(function (r) {
      var g = p.g[r];
      if (g.s === id) { keep[r] = out[r] = 1; if (g.t) keep['node:' + g.t] = 1; if (g.te) keep[g.te] = 1; }
      if (g.t === id) { keep[r] = inn[r] = 1; keep['node:' + g.s] = 1; }
    });
  } else if (p.g[ref]) {
    var g = p.g[ref];
    keep['node:' + g.s] = 1;
    if (g.t) keep['node:' + g.t] = 1;
    if (g.te) keep[g.te] = 1;
  }
  return {keep: keep, inn: inn, out: out, cond: t === 'node' && p.kind[id] === 'condition'};
}
function highlight(p, ref) {
  var R = ref ? related(p, ref) : null;
  p.svg.classList.toggle('hov', !!R);
  p.gEls.forEach(function (n) {
    var r = refOf(n);
    n.classList.toggle('on', !!R && !!R.keep[r]);
    n.classList.toggle('hin', !!R && R.cond && !!R.inn[r]);
    n.classList.toggle('hout', !!R && R.cond && !!R.out[r]);
  });
}
function setupGraph(p) {
  var svg = p.svg;
  function enter(n, x, y) {
    var r = refOf(n);
    if (p.hoverRef === r) { if (hov) { hov.x = x; hov.y = y; placeCard(x, y); } return; }
    p.hoverRef = r; highlight(p, r); showCard(p, r, x, y, focusable(p, r) || n);
  }
  function leave() { p.hoverRef = null; highlight(p, null); hideCard(); }
  svg.addEventListener('mousemove', function (e) {
    var n = e.target.closest(HOOK);
    if (n) enter(n, e.clientX, e.clientY); else if (p.hoverRef) leave();
  });
  svg.addEventListener('mouseleave', leave);
  svg.addEventListener('focusin', function (e) {
    var n = e.target.closest(HOOK); if (!n) return;
    var b = n.getBoundingClientRect(); p.hoverRef = null; enter(n, b.right, b.top);
  });
  svg.addEventListener('focusout', leave);
  svg.addEventListener('click', function (e) {
    var n = e.target.closest(HOOK); if (!n) return;
    pin(p, refOf(n), focusable(p, refOf(n)) || n);
  });
  svg.addEventListener('keydown', function (e) {
    var n = e.target.closest(HOOK);
    if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pin(p, refOf(n), n); }
  });
}

// ---------- drawer ----------
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
  var D = p.data, t = ref.split(':')[0], id = ref.slice(t.length + 1), it = D.items[ref], h = '', title;
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
function markPin(p, ref) {
  $$('.pin', p.el).forEach(function (n) { n.classList.remove('pin'); });
  if (ref) (p.refs[ref] || []).forEach(function (n) { if (n.closest('svg')) n.classList.add('pin'); });
}
function pin(p, ref, opener, fromHash) {
  if (opener && !p.drawer.contains(opener)) p.opener = opener;
  hideCard();
  if (p.sres) p.sres.hidden = true;
  load(p).then(function (D) {
    var focusClaim = null;
    if (ref.indexOf('claim:') === 0) { focusClaim = ref.slice(6); ref = p.owner[focusClaim] || ref; }
    var r = drawerHtml(p, ref);
    if (!r) return;
    $('h3', p.drawer).textContent = r.title;
    $('.dr-body', p.drawer).innerHTML = r.html;
    p.drawer.classList.add('open');
    p.pin = ref; markPin(p, ref);
    if (!fromHash) setHash(p.k + '/' + ref.replace(':', '/'));
    var target = focusClaim && doc.getElementById('dc-' + p.k + '-' + focusClaim.slice(10));
    if (target) { target.classList.add('flash'); target.scrollIntoView({block: 'center'}); }
    else $('.dr-body', p.drawer).scrollTop = 0;
    if (!fromHash) $('h3', p.drawer).focus({preventScroll: !!target});
    else if (innerWidth >= 900) p.drawer.scrollTop = 0;
  }, function () {
    $('.dr-body', p.drawer).innerHTML = '<p>Could not load the claims file. Open the <a href="' + (p.k === 'findings' ? 'claims-findings.html' : 'claims-network.html') + '">claims page</a> instead.</p>';
    p.drawer.classList.add('open');
  });
}
function closeDrawer(p, fromHash) {
  var ref = p.pin;
  p.pin = null; markPin(p, null);
  p.drawer.classList.remove('open');
  $('h3', p.drawer).textContent = 'Details';
  $('.dr-body', p.drawer).innerHTML = '<p class="muted">Select an edge, a node or a table row. Its claims and quotes appear here.</p>';
  if (!fromHash) setHash(p.k);
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
    var t = r.split(':')[0];
    if (t === 'node' || t === 'paper') return;
    var ok = passes(p, r), inl = inLens(p, r), hit = !p.hits || !!p.hits[r], g = p.g[r];
    if (t === 'finding' || t === 'edge') { total++; if (ok && hit) shown++; }
    if (g && inl) { lensN[g.s] = 1; if (g.t) lensN[g.t] = 1; }
    if (g && p.hits && p.hits[r]) { hitN[g.s] = 1; if (g.t) hitN[g.t] = 1; }
    p.refs[r].forEach(function (n) {
      if (n.closest('svg') || n.closest('.mx')) {
        n.classList.toggle('off', !ok); n.classList.toggle('lo', !inl); n.classList.toggle('miss', !hit);
        if (n.hasAttribute('tabindex')) n.setAttribute('tabindex', ok ? '0' : '-1');
      } else if (n.tagName === 'TR') n.classList.toggle('fx', !(ok && hit));
    });
  });
  p.nodes.forEach(function (n) {
    var id = refOf(n).slice(5);
    n.classList.toggle('lo', p.lens !== 'all' && !lensN[id]);
    n.classList.toggle('miss', !!p.hits && !p.hits['node:' + id] && !hitN[id]);
  });
  if (p.docRefs) $$('tr[data-doc]', p.el).forEach(function (tr) {
    var d = tr.getAttribute('data-doc');
    var ok = (p.docRefs[d] || []).some(function (r) { return r.indexOf('inter:') === 0 || passes(p, r); });
    tr.classList.toggle('fx', !(ok && (!p.hits || p.docHit[d])));
  });
  p.count.textContent = 'Showing ' + shown + ' of ' + total + ' ' + (p.k === 'findings' ? 'findings' : 'edges') +
    (p.f.gaps ? '' : ', gaps hidden') + (p.lens !== 'all' ? ', lens: ' + $('[data-lens="' + p.lens + '"]', p.el).textContent : '');
  pageTables(p);
  if (p.claimsOpen) renderClaims(p);
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

// ---------- setup ----------
function setup(el) {
  var k = el.getAttribute('data-panel');
  var p = P[k] = {k: k, el: el, svg: $('svg.graph', el), drawer: $('.drawer', el), refs: {}, g: {}, kind: {}, attr: {},
    f: {dirs: DORD.slice(), min: 0, gaps: true}, lens: 'all', q: '', hits: null, pin: null};
  index(p, $$(HOOK, el));
  p.gEls = $$(HOOK, p.svg);
  p.gEls.forEach(function (n) { n.classList.add('it'); });
  p.nodes = $$('.nd', p.svg);
  $$('.ln', p.svg).forEach(function (n) {
    p.g[refOf(n)] = {s: n.getAttribute('data-s'), t: n.getAttribute('data-t'), te: n.getAttribute('data-te')};
  });
  p.nodes.forEach(function (n) { p.kind[refOf(n).slice(5)] = n.getAttribute('data-kind'); });
  $$('.chip', p.svg).forEach(function (n) { p.attr[refOf(n)] = {dir: n.getAttribute('data-direction'), cert: n.getAttribute('data-certainty')}; });
  $$('.gapl', p.svg).forEach(function (n) { p.attr[refOf(n)] = {gap: 1}; });
  setupGraph(p);

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
    var a = t.closest('a[data-ref], [data-go]');
    if (a) { e.preventDefault(); pin(p, refOf(a), a); return; }
    if (t.closest('.x')) { closeDrawer(p); return; }
    if (t.closest('.more2')) { var h = $('.cl-host', el); h.setAttribute('data-all', h.getAttribute('data-all') === '1' ? '' : '1'); renderClaims(p); return; }
    var tr = t.closest('tr'), r = tr && (tr.getAttribute('data-doc') ? 'paper:' + tr.getAttribute('data-doc') : refOf(tr));
    if (r && !t.closest('a[href^="https:"], button, summary')) { e.preventDefault(); pin(p, r, $('a', tr) || tr); }
  });
  $$('table.sortable', el).forEach(function (t) { sortable(p, t); });
  $$('.more', el).forEach(function (b) { moreBtn(p, b); });
  var cd = $('details.claims', el), pd = $('details.papers', el);
  cd.addEventListener('toggle', function () {
    p.claimsOpen = cd.open;
    if (cd.open) load(p).then(function () { renderClaims(p); }, function () {});
  });
  pd.addEventListener('toggle', function () { if (pd.open) load(p).then(function () { renderPapers(p); }, function () {}); });
  refresh(p);
}

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
    if (hov) hideCard();
    else if (!p.sres.hidden) p.sres.hidden = true;
    else if (p.pin) closeDrawer(p);
  }
});
addEventListener('scroll', function () { if (hov && !hov.p.svg.contains(doc.activeElement)) hideCard(); }, {passive: true});
addEventListener('hashchange', route);
route();
})();
