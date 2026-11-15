// Q2 panel (Created marshes). Vanilla JS, no framework, no external requests.
// app.js loads this file the first time the tab opens (need('q2')), then calls
// Q2.init() and Q2.go(ref). The panel works without it: each row links to
// claims-marshes.html, which lists every quote. This file adds the filters,
// the selection, the drawer and the hash #marshes/<id>.
(function () {
'use strict';
var doc = document, root = doc.documentElement;
var DIR = {below_reference: ['↓', 'Below reference'], comparable: ['=', 'Comparable to reference'], above_reference: ['↑', 'Above reference'],
  mixed: ['↕', 'Mixed (studies disagree)'], unclear: ['?', 'Unclear'], no_effect: ['=', 'No change with age'],
  increase: ['↑', 'Increases with age'], decrease: ['↓', 'Decreases with age']};
var DORD = ['below_reference', 'comparable', 'above_reference', 'increase', 'decrease', 'mixed', 'no_effect', 'unclear'];
var CERT = {high: [4, 'High'], moderate: [3, 'Moderate'], low: [2, 'Low'], very_low: [1, 'Very low']};
var KIND = {ref: 'Vs reference', age: 'With age'};
var AR = ' → ';
var GAPN = 'No study in this corpus tested this pairing. This is a gap, not a negative result.';
var EMPTY = 'Select a finding or a gap. Its claims and quotes show here.';
var PAGE = 'claims-marshes.html';
// S: the panel state. el: the section; refs: id -> elements with that data-q2-ref; rows: id -> board row.
var S = {el: null, refs: {}, rows: {}, data: null, wait: null, it: null, sel: null, opener: null};

function $(s, el) { return (el || doc).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
function pl(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
function un(s) { return String(s).replace(/_/g, ' '); }
function dirW(d) { return DIR[d] ? DIR[d][1] : un(d); }
function dirH(d) { return '<span class="gl d-' + esc(d) + '" aria-hidden="true">' + (DIR[d] ? DIR[d][0] : '') + '</span> ' + esc(dirW(d)); }
function dots(c) { var n = CERT[c] ? CERT[c][0] : 0; return '●●●●'.slice(0, n) + '○○○○'.slice(0, 4 - n); }
function certW(c) { return CERT[c] ? CERT[c][1] : un(c); }
function certH(c) { return '<span class="dots" aria-hidden="true">' + dots(c) + '</span> ' + esc(certW(c)); }
function doiH(d, doi) { return doi ? '<a href="https://doi.org/' + esc(doi) + '">' + esc(doi) + '</a>' : '<span class="mono">' + esc(d) + '</span>'; }
function setHash(h) {
  if (decodeURIComponent(location.hash.slice(1)) !== h) history.replaceState(null, '', '#' + h);
}
function shown(n) { return n && n.isConnected && n.getClientRects().length > 0; }

function load() {
  if (S.data) return Promise.resolve(S.data);
  if (!S.wait) {
    S.wait = fetch('data/marshes.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var it = {};
        (d.findings || []).forEach(function (f) { it[f.id] = {f: f, kind: 'ref'}; });
        (d.with_time || []).forEach(function (f) { it[f.id] = {f: f, kind: 'age'}; });
        (d.gaps || []).forEach(function (g) { it[g.id] = {g: g}; });
        S.data = d; S.it = it;
        return d;
      })
      .catch(function (e) { S.wait = null; throw e; });
  }
  return S.wait;
}

// ---------- filters ----------
// Attribute and certainty hide board rows, gap rows and the "When was it measured?" rows under
// them: each reads its own data-attr and data-certainty. A gap has no certainty, so the gaps
// hide when a level is set. An attribute option has no value attribute, so its value is its
// text (the rows' data-attr).
function filter() {
  var a = S.fa ? S.fa.value : '', c = S.fc ? S.fc.value : '', nf = 0, tf = 0, ng = 0, vis = {};
  $$('tr.q2-row, tr.q2-gap, tr.q2-when', S.el).forEach(function (n) {
    var cl = n.classList, gap = cl.contains('q2-gap'), ok;
    ok = (!a || n.getAttribute('data-attr') === a) && (gap ? !c : !c || n.getAttribute('data-certainty') === c);
    n.hidden = !ok;
    if (ok) vis[n.getAttribute('data-q2-ref')] = 1;
    if (cl.contains('q2-when')) return;
    if (gap) ng += ok ? 1 : 0;
    else { tf++; nf += ok ? 1 : 0; }
  });
  if (S.count) S.count.textContent = 'Showing ' + nf + ' of ' + pl(tf, 'finding', 'findings') + ' · ' + pl(ng, 'gap', 'gaps') +
    (c ? ' (a gap has no certainty)' : '');
  if (S.sel && !vis[S.sel]) clear(false);
}

// ---------- drawer ----------
// Counts per direction as text, and the rank1 bar for the study directions.
function counts(o) {
  return DORD.filter(function (d) { return o && o[d]; }).map(function (d) { return dirW(d) + ' ' + o[d]; }).join(' · ');
}
function sdBar(o) {
  var h = DORD.filter(function (d) { return o && o[d]; }).map(function (d) {
    return '<span class="d-' + d + '" style="flex:' + (+o[d]) + '">' + DIR[d][0] + (+o[d]) + '</span>';
  }).join('');
  return '<div class="sdw"><p class="sdl">Study directions</p><div class="sdbar" aria-hidden="true">' + h + '</div><p class="sdt">' + esc(counts(o)) + '</p></div>';
}
function claimLi(id, C) {
  return '<li><p class="spo">' + esc(C.subject) + ' <span class="pr">→ ' + esc(C.predicate) + (C.negated ? ' (negated)' : '') + ' →</span> ' + esc(C.object) + '</p>' +
    '<p class="cm">' + dirH(C.direction) + ' · grade ' + esc(certW(C.certainty_grade)) + ' · ' + esc((C.evidence_types || []).map(un).join(', ')) +
    ' · comparator: ' + esc(un(C.comparator)) + '</p><blockquote>' + esc(C.quote) + '</blockquote><p class="cid"><code>' + esc(id) + '</code></p></li>';
}
// Claims grouped by paper and ranked by claim grade (app.js rankPapers: the same order as Q1 and Q3).
function byPaper(ids) {
  var E = S.data.evidence, Q = window.Q1, R;
  ids = ids.filter(function (c) { return E[c]; });
  R = Q.rankPapers(ids, function (c) { return E[c].document_id; }, function (c) { return E[c].certainty_grade; });
  return '<h4>Claims by paper (' + pl(R.length, 'paper', 'papers') + ')</h4><p class="pm">' + esc(Q.RANKN) + '</p>' + R.map(function (x) {
    var C = E[x.ids[0]];
    return '<section class="pp"><h5>' + esc(C.title) + (C.year != null ? ' (' + esc(C.year) + ')' : '') + '</h5><p class="pm">' +
      Q.gradesH(x.n, certW) + ' · ' + doiH(x.d, C.doi) + ' · ' + pl(x.ids.length, 'claim', 'claims') +
      '</p><ol class="claims">' + x.ids.map(function (c) { return claimLi(c, E[c]); }).join('') + '</ol></section>';
  }).join('');
}
function drawerHtml(ref) {
  var x = S.it[ref], f, g, h;
  if (!x) return null;
  if (x.g) {
    g = x.g;
    h = '<p class="muted">' + esc(g.subject.label) + ' · Gap</p><p class="big"><span class="nev">No evidence: not tested</span></p>' +
      '<p>' + esc(GAPN) + '</p><p class="rat">Searched for: ' + esc(g.searched_for) + '</p><p>' + pl(g.studies || 0, 'study', 'studies') + ' · 0 claims</p>';
    return {title: g.outcome.label, html: h};
  }
  f = x.f;
  h = '<p class="muted">' + esc(f.subject.label) + ' · ' + KIND[x.kind] + '</p>' +
    '<p class="big">' + dirH(f.direction) + ' · ' + certH(f.certainty) + ' certainty</p>' +
    '<p class="rat">Direction means: ' + esc(f.direction_meaning) + '</p><p class="rat">' + esc(f.certainty_rationale) + '</p>' +
    '<p>' + pl(f.studies, 'study', 'studies') + ' · ' + pl(f.claims, 'claim', 'claims') + '</p>' + sdBar(f.study_directions) +
    '<p class="sdt">Claim directions: ' + esc(counts(f.claim_directions)) + '</p>';
  if (f.lags) h += '<p class="note">Lags: this attribute is below the natural reference.</p>';
  h += '<p>Ages with evidence: ' + ((f.time_points || []).length ? esc(f.time_points.join(', ')) : 'none listed') + '</p>';
  h += byPaper(f.edge_ids || []);
  return {title: f.outcome.label, html: h};
}

// ---------- selection ----------
function mark() {
  Object.keys(S.refs).forEach(function (r) {
    var on = r === S.sel;
    S.refs[r].forEach(function (n) {
      if (n.classList.contains('q2-sel')) { if (on) n.setAttribute('aria-current', 'true'); else n.removeAttribute('aria-current'); }
      else n.classList.toggle('is-sel', on);
    });
  });
}
// how: 'hash' (from the URL: no focus move) or undefined (a click).
function select(ref, opener, how) {
  if (!S.refs[ref]) { clear(false); return; }
  // A link from the URL can name a row that the filters hide: show all rows again.
  if (S.rows[ref] && S.rows[ref].hidden) { [S.fa, S.fc].forEach(function (x) { if (x) x.value = ''; }); filter(); }
  if (opener) S.opener = opener;
  S.sel = ref;
  mark();
  if (how !== 'hash') setHash('marshes/' + ref);
  load().then(function () {
    if (S.sel !== ref) return;
    var r = drawerHtml(ref);
    if (!r) { clear(false); return; }
    S.h.textContent = r.title;
    S.body.innerHTML = r.html;
    S.drawer.scrollTop = 0;
    if (how !== 'hash') S.h.focus();
  }, function () {
    if (S.sel !== ref) return;
    var a = S.rows[ref] && $('a.q2-sel', S.rows[ref]);
    S.body.innerHTML = '<p>Could not load the claims file. Open the <a href="' + esc(a ? a.getAttribute('href') : PAGE) + '">claims page</a> instead.</p>';
  });
}
function clear(refocus, fromHash) {
  var ref = S.sel, o = S.opener, a;
  S.sel = null;
  mark();
  S.h.textContent = 'Details';
  S.body.innerHTML = '<p class="muted">' + esc(EMPTY) + '</p>';
  if (!fromHash) setHash('marshes');
  if (!refocus) return;
  a = ref && S.rows[ref] && $('.q2-sel', S.rows[ref]);
  if (shown(o)) o.focus();
  else if (shown(a)) a.focus();
}

// ---------- API ----------
function init() {
  // Back on the tab: app.js wrote #marshes, so put the open selection back in the hash.
  if (S.el) { if (S.sel && location.hash === '#marshes') setHash('marshes/' + S.sel); return; }
  var el = doc.getElementById('panel-marshes');
  if (!el) return;
  S.el = el;
  S.drawer = $('.q2-drawer', el); S.h = $('#q2-drh', el); S.body = $('.q2-body', el);
  S.fa = $('.q2-fa', el); S.fc = $('.q2-fc', el); S.count = $('.q2-count', el);
  $$('[data-q2-ref]', el).forEach(function (n) {
    var r = n.getAttribute('data-q2-ref');
    (S.refs[r] = S.refs[r] || []).push(n);
    // The board row, not the "When was it measured?" row under it (same data-q2-ref).
    if (n.matches('tr.q2-row, tr.q2-gap')) S.rows[r] = n;
  });
  el.addEventListener('click', function (e) {
    var t = e.target, n = t.closest('.q2-sel');
    if (n && el.contains(n)) {
      // Ctrl, Cmd or Shift on a link: the browser opens the claims page.
      if (n.tagName === 'A' && (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) return;
      e.preventDefault();
      var r = n.getAttribute('data-q2-ref');
      if (r === S.sel) { S.opener = n; clear(true); } else select(r, n);
      return;
    }
    if (t.closest('.q2-x')) clear(true);
  });
  [S.fa, S.fc].forEach(function (s) { if (s) s.addEventListener('change', filter); });
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !S.sel || !root.classList.contains('mr')) return;
    var tag = (doc.activeElement && doc.activeElement.tagName) || '';
    if (tag === 'SELECT') return;
    clear(true);
  });
  el.classList.add('q2-on');
  filter();
  load().catch(function () {});
}
// go(id): select the finding or gap with that id, from the hash. go(null): clear.
// A second go() with the same id changes nothing (only a click toggles).
function go(ref) {
  init();
  if (!S.el) return;
  if (!ref) { if (S.sel) clear(false); return; }
  if (ref !== S.sel) select(ref, null, 'hash');
}
window.Q2 = {init: init, go: go};
})();
