// Tour of the Created marshes panel (Q2). The engine and the step format are in tour.js.
// The tour shows the whole panel: start() clears the filters for the tour, and end() puts the
// reader's filters and URL hash back. The Details step opens the first finding through
// Q2.go() (no hash change, no focus move) only when nothing is selected, and closes it again.
// No digits in the step text: check_site.py fails any text that gives a time to reference.
(function () {
'use strict';
var saved = null, made = null;

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

Q1Tour.add('marshes', {
  title: 'Created marshes',
  start: function (p) {
    var fa = p.querySelector('.q2-fa'), fc = p.querySelector('.q2-fc');
    saved = {hash: location.hash, sel: current(p), fa: fa ? fa.value : '', fc: fc ? fc.value : ''};
    made = null;
    setFilters(p, '', '');
  },
  end: function (p) {
    var s = saved;
    saved = null;
    if (!s) return;
    if (window.Q2 && current(p) !== s.sel) window.Q2.go(s.sel);
    setFilters(p, s.fa, s.fc);
    if (location.hash !== s.hash) history.replaceState(history.state, '', s.hash || location.pathname + location.search);
  },
  steps: [
    {
      target: '.q2-clock',
      title: 'The short answer',
      text: 'This box answers “how long?”: <b>unknown</b>. No study in this corpus reports when a created marsh matches a natural one. ' +
        'The <b>Lags</b> labels name attributes that are below the natural reference.'
    },
    {
      target: '.q2-filters',
      title: 'Make the list shorter',
      text: 'Pick one attribute or one certainty level. The board and the timeline then show only the matching rows. ' +
        'A gap has no grade, so gaps hide when you pick a level.'
    },
    {
      target: function (p) { return first(p, 'tr.q2-row') || p.querySelector('.q2-board'); },
      title: 'Read one row',
      text: 'Each row is one finding. <b>Vs reference</b> rows compare a created marsh with a natural one. ' +
        '<b>With age</b> rows show change as the marsh gets older. The meter shows the direction. ' +
        'The certainty grade and its reason come last.',
      limit: 'The pack pools restored and created marshes, and most of the evidence comes from restored prairie potholes.'
    },
    {
      target: 'tr.q2-gap',
      title: 'A gap is not a result',
      text: 'These rows are gaps: no study tested that attribute. They have a hatched meter and no grade. ' +
        'A gap is not a negative result. A <b>mixed</b>, <b>comparable</b> or <b>no change</b> result is a real finding.'
    },
    {
      target: '.q2-tl',
      title: 'When was it measured?',
      text: 'Each mark is a marsh age at which a study measured the attribute. The marks do not show when a marsh matches the reference. ' +
        'The top rows compare with the reference. The lower rows show change with age.',
      limit: 'A comparison at one age tells you nothing about the marsh at later ages.'
    },
    {
      target: '.q2-foot',
      title: 'Limitations and method',
      text: 'These are the limits of the evidence, word for word from the pack. Read them before you use a finding. ' +
        'Open <b>How this was built</b> to see how the claims were picked and graded.'
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
      title: 'Claims and quotes',
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
    }
  ]
});
})();
