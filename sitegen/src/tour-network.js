// Tour of the Network panel. The engine and the step format are in tour.js.
// Some steps need the panel in a set state: the Graph view, the "All" lens or a selection.
// start() records the state the reader left. Each step's before() asks for the state that it
// needs (want()); what a step does not ask for goes back to the reader's state. end() puts back
// everything: view, lens, selection, URL, the sideways scroll of the graph and the page scroll.
// The hooks only click the panel's own buttons or set the hash, so app.js does the work.
(function () {
'use strict';
var saved = null;

function net() { return window.Q1 && window.Q1.P && window.Q1.P.network; }
function all(panel, s) { return Array.prototype.slice.call(panel.querySelectorAll(s)); }
function press(b) { if (b) b.click(); }
// The details list one closed dropdown per paper. The Details step opens the first one, so a claim
// and its quote show, and closes it again. A paper that was open already stays as it is.
var paper = null;
function openPaper(el) {
  if (paper && paper.isConnected) return;
  var d = el && el.querySelector('details.pp');
  paper = d && !d.open ? d : null;
  if (paper) paper.open = true;
}
function shutPaper() { if (paper && paper.isConnected) paper.open = false; paper = null; }
function box(panel) { return panel.querySelector('.gbox'); }
// On a narrow screen the graph is wider than its box, and the box scrolls sideways.
function narrow(panel) { var b = box(panel); return !!b && b.scrollWidth > b.clientWidth + 1; }

// Select (or clear) through the hash: route() in app.js then pins the item, with no scroll and no focus.
function go(h) {
  history.replaceState(history.state, '', '#' + h);
  var e;
  try { e = new HashChangeEvent('hashchange'); } catch (x) { e = document.createEvent('Event'); e.initEvent('hashchange', false, false); }
  window.dispatchEvent(e);
}

function snap(panel) {
  var p = net(), b = box(panel);
  return {mx: !!panel.querySelector('.viz.mxon'), lens: p ? p.lens : 'all', pin: p ? p.pin : null,
    sl: b ? b.scrollLeft : 0, url: location.href, x: scrollX, y: scrollY};
}

// Put the panel in the state a step needs. need.pin: undefined keeps the reader's selection,
// null clears it, a function returns the item to select. need.fit: a function that returns
// the lit elements; on a narrow screen the graph box scrolls sideways to show them.
function want(panel, need) {
  var s = saved, p = net(), b = box(panel);
  if (!s || !p) return;
  need = need || {};
  var mx = need.graph ? false : s.mx;
  if (!!panel.querySelector('.viz.mxon') !== mx) press(panel.querySelector('[data-view="' + (mx ? 'matrix' : 'graph') + '"]'));
  var lb = panel.querySelector('[data-lens="' + (need.lens || s.lens) + '"]');
  if (lb && lb.getAttribute('aria-pressed') !== 'true') press(lb);
  var ref = need.pin === undefined ? s.pin : typeof need.pin === 'function' ? need.pin(panel) : need.pin;
  if (p.pin !== ref) go(ref ? 'network/' + ref.replace(':', '/') : 'network');
  if (b) b.scrollLeft = need.fit && narrow(panel) ? left(b, need.fit(panel)) : s.sl;
}
// The sideways scroll that shows the elements: centred when they fit in the box, else from their left edge.
function left(b, list) {
  var r = b.getBoundingClientRect(), l = Infinity, w = -Infinity;
  list.forEach(function (e) { var q = e.getBoundingClientRect(); if (q.width || q.height) { l = Math.min(l, q.left); w = Math.max(w, q.right); } });
  if (l === Infinity) return b.scrollLeft;
  var x = l - r.left + b.scrollLeft, room = b.clientWidth;
  w -= l;
  return w <= room ? x - (room - w) / 2 : x - 8;
}

// Step 3: the key at the top of the graph.
function key(panel) { return all(panel, 'svg.graph .glg'); }
// Step 4: the lanes and the nodes. On a narrow screen only the conditions, so they show in the box.
function lanes(panel) {
  return narrow(panel) ? all(panel, 'svg.graph .nd.k-condition') : all(panel, 'svg.graph .lt, svg.graph .nodes');
}
// Step 4: the condition with the most edges in and out, so its pathway runs through the middle.
function hub(panel) {
  var best = null, top = -1;
  all(panel, 'svg.graph .nd.k-condition').forEach(function (n) {
    var id = n.getAttribute('data-node-id'), i = 0, o = 0, k;
    all(panel, 'svg.graph .ln:not(.gap):not(.mod)').forEach(function (l) {
      if (l.getAttribute('data-t') === id) i++;
      if (l.getAttribute('data-s') === id) o++;
    });
    k = Math.min(i, o) * 1000 + i + o;
    if (k > top) { top = k; best = id; }
  });
  return best ? 'node:' + best : null;
}
// Step 5: a node whose pathway shows a moderation and a combination membership: the source of a
// moderation line that is also a member of a combination (else the first of either).
function moder(panel) {
  var mods = all(panel, 'svg.graph .ln.mod').map(function (l) { return l.getAttribute('data-s'); });
  var mems = all(panel, 'svg.graph .mem').map(function (m) { return m.getAttribute('data-m'); });
  var id = mods.filter(function (x) { return mems.indexOf(x) >= 0; })[0] || mods[0] || mems[0];
  return id ? 'node:' + id : null;
}
// Step 5, the lit part: the moderation line, chip and diamond, the combination nodes, their
// member lines, and the moderating and member nodes.
function inter(panel) {
  var ids = {}, list = all(panel, 'svg.graph .nd.k-combo, svg.graph .mem, svg.graph .ln.mod, svg.graph .chip.mod, svg.graph .dia');
  all(panel, 'svg.graph .mem').forEach(function (m) { ids[m.getAttribute('data-m')] = 1; });
  all(panel, 'svg.graph .ln.mod').forEach(function (l) { ids[l.getAttribute('data-s')] = 1; });
  all(panel, 'svg.graph .nd').forEach(function (n) { if (ids[n.getAttribute('data-node-id')]) list.push(n); });
  return list;
}
// Step 6: the reader's own edge, or else a small edge (the fewest claims, at least two), so the
// details panel shows claims and quotes, and the example fits on the screen.
function example(panel) {
  if (saved && /^edge:/.test(saved.pin || '')) return saved.pin;
  var best = null, n = Infinity;
  all(panel, 'svg.graph .chip[data-edge-id]').forEach(function (c) {
    if (c.classList.contains('mod') || c.classList.contains('off')) return;
    var k = +c.getAttribute('data-claims') || 0;
    k = k < 2 ? k + 1000 : k;
    if (k < n) { n = k; best = c.getAttribute('data-edge-id'); }
  });
  return best ? 'edge:' + best : null;
}

Q1Tour.add('network', {
  title: 'Network',
  start: function (panel) { saved = snap(panel); },
  end: function (panel) {
    var s = saved;
    if (!s) return;
    want(panel, {});
    history.replaceState(history.state, '', s.url);
    scrollTo(s.x, s.y);
    saved = null;
  },
  steps: [
    {target: '.toolbar', title: 'Search and filters', place: 'below',
      before: function (panel) { want(panel, {}); },
      text: 'Search finds nodes, edges, papers and quotes. ' +
        'The filters hide edges by direction or certainty. On a phone, swipe this bar sideways.'},
    {target: '.vtools, .selbar', title: 'Edges show when you select', place: 'below',
      before: function (panel) { want(panel, {}); },
      text: 'The graph starts with the nodes only. Click a node to see its edges, or turn on <b>Show all edges</b>. ' +
        '<b>Matrix</b> shows the same edges as a table. The status box describes your selection.'},
    {target: key, title: 'How to read this graph',
      before: function (panel) { want(panel, {graph: true, fit: key}); },
      text: 'This key explains the marks. On each chip, the arrow gives the direction and the dots give the certainty. ' +
        '<b>Mixed</b> and <b>No effect</b> are results from studies. They are not gaps.',
      limit: '“No evidence” means that no study tested that pairing; it is not a negative result.'},
    {target: lanes, title: 'Conditions in the middle',
      before: function (panel) { want(panel, {graph: true, lens: 'all', pin: hub, fit: lanes}); },
      text: 'Planting stock and site treatments are on the left. Conditions are in the middle. Outcomes are on the right. ' +
        'This step selects one condition to show its pathways.',
      limit: 'A path through a condition joins two separate bodies of evidence, not one tested effect, so do not multiply the edges.'},
    {target: inter, title: 'Moderation and combinations',
      before: function (panel) { want(panel, {graph: true, lens: 'all', pin: moder, fit: inter}); },
      text: 'A dotted line to a ◆ is a moderation: it changes the effect of that edge. ' +
        'A dashed node is a combined treatment. Thin dotted lines link it to its members. This step selects one example.'},
    {target: function (panel) { var d = panel.querySelector('.drawer'); openPaper(d); return d ? [d] : []; },
      title: 'Claims and quotes', place: 'left',
      before: function (panel) { want(panel, {pin: example}); },
      after: shutPaper,
      text: 'Click a chip to select one edge. The details panel shows its direction, its certainty and the reason for the grade. ' +
        'Below, each paper is a dropdown: open it to read its claims, each with the quote, year and DOI.',
      limit: 'Conditions are matched by keyword, so read the claims behind an edge before you rely on it.'},
    {target: '.gfoot', title: 'Export and limitations',
      before: function (panel) { want(panel, {}); },
      text: '<b>Copy image</b> copies the graph as you see it. <b>Export CSV</b> and <b>XLSX</b> download the highlighted data. ' +
        '<b>Limitations</b> lists the limits of the evidence pack, word for word.'}
  ]
});
})();
