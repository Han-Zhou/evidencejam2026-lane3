// Tour of the Findings panel (Q1). The engine and the step format are in tour.js.
// Order: read the graph first (key, graph, details), then the tools (view bar, toolbar), then
// the exports and the limitations.
// State: start() shows the Graph view with all edges, because the first two steps light parts of
// the graph. Steps 3 and 4 need a selection. When the reader has none, the tour selects one
// example finding through the URL hash (as a shared link does: no focus move, no scroll) and
// clears it on every other step. end() puts back the view, "Show all edges", the URL hash and
// the scroll position. A selection that the reader made stays as it is.
// Phone: the graph and the toolbar are wider than the screen and scroll sideways. Steps 2 and 5
// then add one line that says so, and step 2 scrolls the graph box to the chips and back.
(function () {
'use strict';
var saved = null, own = null; // own: the ref of the example finding that the tour selected
var sx = null; // the graph box's own sideways scroll before step 2 moved it (phone)
var GRAPH = 'Factors are on the left, outcomes on the right. Each chip between them is one finding. ' +
  '<b>Mixed</b> and <b>No effect</b> are real results, not gaps. Click a chip or a node to select it.';
var DETAILS = 'This part shows the details of what you select: the certainty grade, the reason for it and the study counts. ' +
  'Each paper is a dropdown: open it to read its claims and their source quotes.';
var EXAMPLE = '<i>The tour selected one finding as an example.</i>';
var FILTERS = 'Search finds nodes, findings, papers and words in the quotes. The direction buttons and the certainty menu hide the findings that you do not need. ' +
  'The count tells you how many show.';

function $(s, p) { return p.querySelector(s); }
// True when a box is wider than the screen gives it (a phone): it scrolls sideways.
function over(e) { return !!e && e.scrollWidth > e.clientWidth + 1; }
// Phone: the graph is wider than its box. Scroll the box so that the chip column shows.
function toChips(p) {
  var box = $('.gbox', p), ch = $('svg.graph > .chips', p);
  sx = null;
  if (!over(box) || !ch) return;
  var b = box.getBoundingClientRect(), c = ch.getBoundingClientRect();
  if (c.left >= b.left && c.right <= b.right) return;
  sx = box.scrollLeft;
  box.scrollLeft += (c.left + c.right - b.left - b.right) / 2;
}
function unChips(p) {
  var box = $('.gbox', p);
  if (sx != null && box) box.scrollLeft = sx;
  sx = null;
}
function state() { return window.Q1 && window.Q1.P && window.Q1.P.findings; }
// The details list one closed dropdown per paper. Step 3 opens the first one, so a claim and its
// quote show, and closes it again. A paper that was open already stays as it is.
var paper = null;
function openPaper(el) {
  if (paper && paper.isConnected) return;
  var d = el && el.querySelector('details.pp');
  paper = d && !d.open ? d : null;
  if (paper) paper.open = true;
}
function shutPaper() { if (paper && paper.isConnected) paper.open = false; paper = null; }
// Change the hash without a history entry, then let app.js route it (its hashchange handler).
function route(h) {
  history.replaceState(history.state, '', h);
  var e;
  try { e = new HashChangeEvent('hashchange'); } catch (x) { e = document.createEvent('Event'); e.initEvent('hashchange', false, false); }
  dispatchEvent(e);
}
// The example: the first finding chip that the filters and the search do not hide.
function demo(p) {
  var st = state();
  if (!st || st.pin) return;
  var cs = p.querySelectorAll('svg.graph .chip[data-finding-id]'), c = null;
  for (var i = 0; i < cs.length && !c; i++) if (!cs[i].matches('.off, .miss')) c = cs[i];
  c = c || cs[0];
  if (!c) return;
  own = 'finding:' + c.getAttribute('data-finding-id');
  route('#findings/finding/' + c.getAttribute('data-finding-id'));
}
// Clear the example (only when it is still the selection), then put the reader's own URL back.
function undemo() {
  var st = state();
  if (own && st && st.pin === own) {
    route('#findings');
    if (saved) history.replaceState(history.state, '', saved.href);
  }
  own = null;
}

var steps = [
  {
    target: 'svg.graph > .glg',
    title: 'Start here: how to read the graph',
    text: ['Each finding links one factor to one outcome.',
      'The arrow shows the direction: increase, decrease, mixed, no effect or unclear. More filled dots mean higher certainty.'],
    limit: '“No evidence” means that no study tested that pairing: it is a gap, not a negative result.',
    before: undemo
  },
  {
    target: 'svg.graph > .lt, svg.graph > .lines, svg.graph > .nodes, svg.graph > .chips',
    title: 'The findings',
    text: GRAPH,
    limit: '“Growth” combines height, diameter and biomass, so a factor can raise one of them and not another.',
    before: function (p) {
      undemo();
      steps[1].text = over($('.gbox', p)) ? [GRAPH, 'Swipe the graph sideways to see all of it.'] : GRAPH;
      toChips(p);
    },
    after: unChips
  },
  {
    // The top of the details: the header, the direction and certainty, the rationale, the counts
    // and the first claim with its quote. Nothing is lit until the details show (the engine
    // tries again on each frame).
    target: function (p) {
      var d = $('.drawer', p);
      if (!d || !d.classList.contains('open')) return [];
      openPaper(d);
      var li = $('.dr-body .claims > li', d);
      return li ? [$('.dr-head', d), li] : [d];
    },
    title: 'Details: claims and quotes',
    text: DETAILS,
    limit: 'The pack finds claims by keywords, so it can miss a claim with unusual words.',
    before: function (p) { demo(p); steps[2].text = own ? [DETAILS, EXAMPLE] : DETAILS; },
    after: shutPaper
  },
  {
    // Wide screens: one row. Below 1100 px the bar has no box of its own, so its two parts are named.
    target: '.vtools, .selbar',
    title: 'Views and the status line',
    text: '<b>Matrix</b> shows the same findings as a table. <b>Expand</b> opens a large view. ' +
      'Turn off <b>Show all edges</b> to see only the edges of your selection. The status line names what is selected.',
    before: demo
  },
  {
    target: '.toolbar',
    title: 'Search and filter',
    text: FILTERS,
    before: function (p) {
      undemo();
      steps[4].text = over($('.toolbar', p)) ? [FILTERS, 'Swipe this bar sideways to see all the filters.'] : FILTERS;
    }
  },
  {
    target: '.gfoot',
    title: 'Export and limitations',
    text: '<b>Copy image</b> copies the graph as it shows now. <b>Export CSV</b> and <b>Export XLSX</b> download your selection, or all the findings that show. ' +
      'Read the limitations before you use a finding.',
    before: undemo
  }
];

Q1Tour.add('findings', {
  title: 'Findings',
  start: function (p) {
    var vb = $('.viz', p), eb = $('.eab', p);
    saved = {href: location.href, y: scrollY, mx: !!(vb && vb.classList.contains('mxon')), ea: p.classList.contains('ea')};
    own = null;
    if (saved.mx) $('[data-view="graph"]', p).click();
    if (!saved.ea && eb) eb.click();
  },
  end: function (p) {
    var s = saved, eb = $('.eab', p);
    undemo();
    saved = null;
    if (!s) return;
    if (eb && p.classList.contains('ea') !== s.ea) eb.click();
    if (s.mx) $('[data-view="matrix"]', p).click();
    if (location.href !== s.href) history.replaceState(history.state, '', s.href);
    scrollTo(scrollX, s.y);
  },
  steps: steps
});
})();
