// Tour of the Created marshes panel (Q2). The engine and the step format are in tour.js.
// Order, as in the Findings tour: the answer and how to read the panel first (short answer,
// coverage bar, one row, its "When was it measured?" fold-out, the details), then the filters,
// then the limitations.
// State: start() clears the filters for the tour, and end() puts the reader's filters and URL
// hash back. The fold-out step opens one "When was it measured?" and closes it again. The
// Details step opens the first finding through Q2.go() (no hash change, no focus move) only when
// nothing is selected, and closes it again.
// No digits in the step text: check_site.py fails any text that gives a time to reference.
(function () {
'use strict';
var saved = null, made = null, opened = null;

function boxed(e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
// The first match that the filters do not hide.
function first(p, sel) { return Array.prototype.filter.call(p.querySelectorAll(sel), boxed)[0] || null; }
function current(p) { var r = p.querySelector('tr.is-sel'); return r ? r.getAttribute('data-q2-ref') : null; }
// Set the two filters and let q2.js redraw (it listens for "change" on each select).
function setFilters(p, a, c) {
  var fa = p.querySelector('.q2-fa'), fc = p.querySelector('.q2-fc');
  if (!fa || !fc || (fa.value === a && fc.value === c)) return;
  fa.value = a; fc.value = c;
  fa.dispatchEvent(new Event('change', {bubbles: true}));
}
// The fold-out for the fold-out step: the one under the first row (the row of the step before)
// when its finding lists ages, else the first one that has age marks.
function when(p) {
  var r = first(p, 'tr.q2-row'), w = r && r.nextElementSibling;
  if (w && w.matches('tr.q2-when') && w.querySelector('.q2-tm')) return w;
  return Array.prototype.filter.call(p.querySelectorAll('tr.q2-when'), function (x) {
    return boxed(x) && x.querySelector('.q2-tm');
  })[0] || null;
}
function shut() {
  if (opened) opened.open = false;
  opened = null;
}

Q1Tour.add('marshes', {
  title: 'Created marshes',
  start: function (p) {
    var fa = p.querySelector('.q2-fa'), fc = p.querySelector('.q2-fc');
    saved = {hash: location.hash, sel: current(p), fa: fa ? fa.value : '', fc: fc ? fc.value : ''};
    made = null; opened = null;
    setFilters(p, '', '');
  },
  end: function (p) {
    var s = saved;
    saved = null;
    shut();
    if (!s) return;
    if (window.Q2 && current(p) !== s.sel) window.Q2.go(s.sel);
    setFilters(p, s.fa, s.fc);
    if (location.hash !== s.hash) history.replaceState(history.state, '', s.hash || location.pathname + location.search);
  },
  steps: [
    {
      target: '.q2-clock',
      title: 'Start here: the short answer',
      text: 'This box answers “how long?”: <b>unknown</b>. No study in this corpus reports when a created marsh matches a natural one. ' +
        'The <b>Lags</b> labels name attributes that are below the natural reference.'
    },
    {
      // The coverage bar at the top of the panel.
      target: '.q2-cov',
      title: 'Evidence by marsh age',
      text: 'This bar counts the findings that studies measured at each marsh age. Darker means more findings. ' +
        'Hatched means no finding: a gap, not a negative result.'
    },
    {
      target: function (p) { return first(p, 'tr.q2-row') || p.querySelector('.q2-board'); },
      title: 'The findings',
      text: 'Each row is one finding. <b>Vs reference</b> rows compare a created marsh with a natural one. ' +
        '<b>With age</b> rows show change as the marsh gets older. The meter shows the direction. ' +
        'The certainty grade and its reason come last.',
      limit: 'A <b>Gap</b> row means that no study tested that attribute: it is not a negative result. ' +
        '<b>Mixed</b> and <b>comparable</b> are real findings.'
    },
    {
      // The fold-out under a row, opened for this step only (a fold-out the reader opened stays open).
      target: function (p) {
        var w = when(p);
        return w ? [w] : [];
      },
      title: 'When was it measured?',
      text: 'Open <b>When was it measured?</b> under a row. The marks show the marsh ages at which its studies measured the attribute. ' +
        'They do not show when a marsh matches the reference.',
      limit: 'A comparison at one age tells you nothing about the marsh at later ages.',
      before: function (p) {
        var w = when(p), d = w && w.querySelector('details.q2-wd');
        if (d && !d.open) { d.open = true; opened = d; }
      },
      after: shut
    },
    {
      // Wide screens: the whole drawer (it scrolls in its own box). Narrow screens (q2.css drops
      // its max-height) put the drawer under the panel at full length: light its first paper and
      // claim, so that a quote shows above the docked card.
      target: function (p) {
        var d = p.querySelector('.q2-drawer'), h, li;
        if (d && getComputedStyle(d).maxHeight === 'none') {
          h = d.querySelector('.q2-body h4'); li = d.querySelector('.q2-body ol.claims > li');
          if (h && li) return [h, li];
        }
        return d;
      },
      title: 'Details: claims and quotes',
      text: 'Select an attribute name to see its details. At the end, the details list each claim with its source quote and its paper. ' +
        'Select the name again to close them.',
      limit: 'The side of each claim (created or natural marsh) comes from keywords, so check it in the quote.',
      // Nothing selected: show the first finding as an example (as from a hash: no focus move).
      before: function (p) {
        if (!window.Q2 || current(p)) return;
        var r = first(p, 'tr.q2-row');
        made = r ? r.getAttribute('data-q2-ref') : null;
        if (made) window.Q2.go(made);
      },
      after: function (p) {
        if (made && window.Q2 && current(p) === made) window.Q2.go(null);
        made = null;
      }
    },
    {
      target: '.q2-filters',
      title: 'Filter the list',
      text: 'Pick one attribute or one certainty level. The list then shows only the matching rows. ' +
        'A gap has no grade, so gaps hide when you pick a level.'
    },
    {
      target: '.q2-foot',
      title: 'Limitations and method',
      text: 'These are the limits of the evidence, word for word from the pack. Read them before you use a finding. ' +
        'Open <b>How this was built</b> to see how the claims were picked and graded.'
    }
  ]
});
})();
