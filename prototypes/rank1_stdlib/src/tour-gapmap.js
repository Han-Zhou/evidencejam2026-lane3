// Tour of the Gap map panel (Q3). The engine and the step format are in tour.js.
// Steps 5 to 7 need a selected cell. When the reader has none, the tour selects one example
// cell (the top shown row, its densest cell) and clears it again on every other step and when
// the tour closes. A cell that the reader selected stays as it is. Nothing else changes.
(function () {
'use strict';
var own = null; // the cell that the tour selected, or null
var TIER = {thin: 1, some: 2, dense: 3, densest: 4};

function pinned(p) { return p.querySelector('.q3t .pin'); }
// A cell in the part of the map that shows now: not hidden, not under the row labels, not
// scrolled out of the map box.
function inView(p, e) {
  var box = p.querySelector('.q3box'), th = p.querySelector('.q3t tbody tr:not([hidden]) th'), r = e.getBoundingClientRect();
  if (!box || !r.width) return false;
  var B = box.getBoundingClientRect(), lo = th ? Math.max(B.left, th.getBoundingClientRect().right) : B.left;
  return r.left >= lo - 1 && r.right <= B.right + 1;
}
// The example cell: a finding in the top shown row (its densest one, then the leftmost).
// When no finding shows (all faded or scrolled away), a gap in the top shown row.
function example(p) {
  function best(sel, score) {
    var out = null, k = null;
    Array.prototype.forEach.call(p.querySelectorAll(sel), function (e) {
      if (!inView(p, e)) return;
      var r = e.getBoundingClientRect(), s = [Math.round(r.top), -score(e), Math.round(r.left)];
      if (!k || s[0] < k[0] || (s[0] === k[0] && (s[1] < k[1] || (s[1] === k[1] && s[2] < k[2])))) { out = e; k = s; }
    });
    return out;
  }
  return best('.q3t button.q3c:not(.off)', function (e) { return TIER[e.getAttribute('data-tier')] || 0; }) ||
    best('.q3t td.q3g', function () { return 0; });
}
function demo(p) {
  if (pinned(p)) return;
  var c = example(p);
  if (c) { c.click(); own = c; }
}
// The details under the map, or null while the claims of the selected cell load (the engine
// tries again on each frame). whole: light all of the details (a gap, or no cell selected).
function details(p) {
  var dr = p.querySelector('.q3dr'), body = dr && dr.querySelector('.dr-body'), c = pinned(p);
  if (!body || (c && !body.querySelector('.big'))) return null;
  return {dr: dr, head: dr.querySelector('.dr-head'), body: body, whole: !c || c.matches('td.q3g')};
}
function undemo() {
  // A second click on the selected cell clears it (gapmap.js), with the same result as "Clear".
  if (own && own.isConnected && own.classList.contains('pin')) own.click();
  own = null;
}

Q1Tour.add('gapmap', {
  title: 'Gap map',
  end: undemo,
  steps: [
    {
      target: '.q3sum, .q3dense',
      title: 'What this map shows',
      text: 'The map shows how much grassland restoration evidence there is for each pair of intervention and outcome. ' +
        'Open the list of the densest cells to go to one of them.',
      limit: 'The map misses grassland claims that have a different ecosystem tag or that fit no group.',
      before: undemo
    },
    {
      target: '.q3top',
      title: 'Read the colours',
      text: ['A darker fill means more studies tested the pairing.',
        'A <b>hatched grey</b> cell is a gap: no study tested that pairing. It is not a negative result.',
        'The export buttons save the map as you see it.'],
      limit: 'The colour does not show the direction or the certainty. A dense cell can still be mixed.',
      before: undemo
    },
    {
      target: '.q3box',
      title: 'Rows, columns and cells',
      text: 'Each row is an outcome. Each column is an intervention. Each cell is one pair of them. ' +
        'On a small screen, scroll the map sideways. The labels stay in view.',
      limit: 'One claim can be in more than one group, so it can count in more than one cell.',
      before: undemo
    },
    {
      target: '.q3bar',
      title: 'Sort and filter',
      text: 'Sort the rows and the columns. Choose the outcomes and interventions to show. ' +
        'Set a minimum density, or hide empty rows and columns. Faded cells are below the minimum. They are not gaps.',
      before: undemo
    },
    {
      // The status line and the selected cell (when it shows in the map box).
      target: function (p) {
        var c = pinned(p), st = p.querySelector('.q3st');
        return c && inView(p, c) ? [st, c] : [st];
      },
      title: 'Select a cell',
      text: 'Select any cell to read about it. The line above the map shows the density, direction, certainty, ' +
        'studies and claims of the outlined cell. <b>Clear</b> removes the selection.',
      before: demo
    },
    {
      // The top of the details: the pairing, its density, certainty, direction and rationale.
      target: function (p) {
        var d = details(p);
        if (!d || d.whole) return d ? [d.dr] : [];
        var out = [d.head];
        for (var i = 0; i < d.body.children.length; i++) {
          out.push(d.body.children[i]);
          if (d.body.children[i].matches('.rat')) break;
        }
        return out;
      },
      title: 'Certainty and rationale',
      text: 'The details panel shows the certainty grade and the direction of the finding. ' +
        'The rationale tells you why it has that grade. For a gap, the details show what was searched for.',
      before: demo
    },
    {
      // The claims: the heading, then the first paper and its first claim with the quote.
      target: function (p) {
        var d = details(p);
        if (!d || d.whole) return d ? [d.dr] : [];
        var pp = d.body.querySelector('section.pp');
        return [d.body.querySelector('h4'), pp && pp.querySelector('h5'), pp && pp.querySelector('.pm'),
          pp && pp.querySelector('.claims > li')].filter(Boolean);
      },
      title: 'Claims and quotes',
      text: 'Below the grade, each paper shows its title and DOI, then its claims. ' +
        'Each claim has the exact quote from the source, so you can check the finding.',
      before: demo
    }
  ]
});
})();
