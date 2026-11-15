// Panel tours. "Want help?" next to the page title opens a short guided tour of the open panel.
// Each step dims the page and leaves one part lit, with a small card of text beside it.
// This file is the engine only. The steps of each panel are in tour-<panel>.js, which calls
// Q1Tour.add(). app.js loads this file, tour.css and the open panel's steps file on the first
// click on "Want help?" (see need() in app.js). Nothing here loads on the first view.
//
// A tour definition:
//   Q1Tour.add('findings', {
//     title: 'Findings',              // fallback name on the card; the panel's tab name wins:
//                                     // "Seedling findings · Step 2 of 6"
//     start: function (panel) {},     // optional: runs when the tour opens
//     end: function (panel) {},       // optional: runs when the tour closes (put the panel back)
//     steps: [{
//       target: '.toolbar',           // CSS selector inside the panel (all visible matches are lit
//                                     // as one box), or function (panel) returning an element or a
//                                     // list, or null for a card in the middle with nothing lit
//       title: 'Search and filter',
//       text: 'One short paragraph.', // or an array of short paragraphs; <b> and <i> are allowed
//       limit: 'One short sentence.', // optional: shown as "Limit: ..."
//       place: 'right',               // optional: first side to try (right, left, below, above)
//       pad: 8,                       // optional: space around the lit box, in px
//       before: function (panel) {},  // optional: runs before the step shows (open a view, select)
//       after: function (panel) {}    // optional: runs when the step goes (put back what before did)
//     }]
//   });
(function () {
'use strict';
var doc = document, root = doc.documentElement;
var defs = {}, S = null;
var reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : {matches: true};
var M = 16, GAP = 14;

function add(key, def) { defs[key] = def; }
function run(f, panel) { if (typeof f === 'function') try { f(panel); } catch (e) { if (window.console) console.error(e); } }

// The lit elements of a step: every match that has a box on the screen.
function targets(step, panel) {
  var t = step.target, list = [];
  if (!t) return [];
  try {
    if (typeof t === 'function') t = t(panel);
    if (typeof t === 'string') list = panel.querySelectorAll(t);
    else if (t && t.nodeType === 1) list = [t];
    else if (t) list = t;
  } catch (e) { return []; }
  return Array.prototype.filter.call(list, function (e) {
    if (!e || !e.getBoundingClientRect) return false;
    var r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}
// The ancestors that clip an element (overflow not visible), for each axis. A part inside a box
// that scrolls sideways (the graph on a phone, the gap map) is lit only where it shows.
function clipsOf(e) {
  var out = [];
  for (var a = e.parentElement; a && a !== doc.body; a = a.parentElement) {
    var cs = getComputedStyle(a), x = cs.overflowX !== 'visible', y = cs.overflowY !== 'visible';
    if (x || y) out.push([a, x, y]);
  }
  return out;
}
// One box around the lit elements, each cut to the boxes that clip it. clips: from clipsOf().
function bbox(list, pad, clips) {
  var l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  list.forEach(function (e, i) {
    var q = e.getBoundingClientRect(), L = q.left, T = q.top, R = q.right, B = q.bottom;
    (clips && clips[i] || []).forEach(function (c) {
      var k = c[0].getBoundingClientRect();
      if (c[1]) { L = Math.max(L, k.left); R = Math.min(R, k.right); }
      if (c[2]) { T = Math.max(T, k.top); B = Math.min(B, k.bottom); }
    });
    if (R - L < 1 || B - T < 1) return;
    l = Math.min(l, L); t = Math.min(t, T); r = Math.max(r, R); b = Math.max(b, B);
  });
  return l === Infinity ? null : {l: l - pad, t: t - pad, r: r + pad, b: b + pad};
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(v, hi)); }
function phone() { return root.clientWidth < 700; }
// The area of a card at (x, y) that covers the part of the lit box on the screen.
function cover(b, x, y, cw, ch) {
  if (!b) return 0;
  var w = Math.min(b.r, innerWidth, x + cw) - Math.max(b.l, 0, x), h = Math.min(b.b, innerHeight, y + ch) - Math.max(b.t, 0, y);
  return w > 0 && h > 0 ? w * h : 0;
}
// True when an element, or a box that holds it, is sticky or fixed: it stays on the screen.
function pinnedEl(e) {
  for (var a = e; a && a !== doc.body; a = a.parentElement) {
    var p = getComputedStyle(a).position;
    if (p === 'sticky' || p === 'fixed') return true;
  }
  return false;
}

// The pinned bars at the top of the open panel (Findings and Network: the toolbar and the view
// bar). A lit part must not sit under them, so scrolling keeps it below their bottom edge.
// A bar counts only when it is above the lit part (the view bar is not above the drawer).
function topInset(list, b) {
  var y = M;
  if (!S) return y;
  ['.toolbar', '.vbar', '.selbar'].forEach(function (s) {
    var e = S.panel.querySelector(s);
    if (!e || list.some(function (x) { return e.contains(x) || x.contains(e); })) return;
    var cs = getComputedStyle(e);
    if (cs.position !== 'sticky' && cs.position !== 'fixed') return;
    var r = e.getBoundingClientRect();
    if (r.height && r.left < b.r && r.right > b.l) y = Math.max(y, (parseFloat(cs.top) || 0) + r.height + 12);
  });
  return y;
}
// Scroll the lit part into view, but only when it is not in view already. A part in a pinned
// bar is on the screen already, so the page does not move for it.
function reveal(list, clips) {
  var b = bbox(list, 0, clips);
  if (!b) return;
  var H = innerHeight, top = topInset(list, b), bot = H - M - (phone() && S ? S.card.offsetHeight + 8 : 0);
  var h = b.b - b.t, room = bot - top;
  if (b.t >= top && b.b <= bot) return;
  if (b.t >= 0 && b.b <= H && list.some(pinnedEl)) return;
  var want = h <= room ? top + (room - h) / 2 : top;
  scrollBy({top: b.t - want, behavior: reduce.matches ? 'auto' : 'smooth'});
}

// Put the card beside the lit box: the step's own side first, then right, left, below, above.
// When no side has room (a large part, such as the whole graph), the card goes to the corner
// where it covers the least of the lit part. On a phone it docks at the bottom or the top,
// where it covers less.
function place(b) {
  var c = S.card, W = root.clientWidth, H = innerHeight, cw = c.offsetWidth, ch = c.offsetHeight, x, y;
  function least(spots) {
    var best = spots[0], k = Infinity;
    spots.forEach(function (s) { var v = cover(b, s[0], s[1], cw, ch); if (v < k - 1) { k = v; best = s; } });
    x = best[0]; y = best[1];
  }
  c.classList.toggle('dock', phone());
  if (phone()) {
    least([[M, H - ch - M], [M, M]]);
  } else if (!b) {
    x = (W - cw) / 2; y = (H - ch) / 2;
  } else {
    var room = {right: W - b.r - GAP - M, left: b.l - GAP - M, below: H - b.b - GAP - M, above: b.t - GAP - M};
    var order = ['right', 'left', 'below', 'above'], pref = S.def.steps[S.i].place, side = null;
    if (pref) order = [pref].concat(order.filter(function (s) { return s !== pref; }));
    order.some(function (s) {
      var fit = (s === 'right' || s === 'left') ? room[s] >= cw : room[s] >= ch;
      if (fit) side = s;
      return fit;
    });
    if (side === 'right' || side === 'left') {
      x = side === 'right' ? b.r + GAP : b.l - GAP - cw;
      y = clamp(b.t, M, H - ch - M);
    } else if (side) {
      y = side === 'below' ? b.b + GAP : b.t - GAP - ch;
      x = clamp(b.l, M, W - cw - M);
    } else {
      least([[W - cw - M, H - ch - M], [M, H - ch - M], [W - cw - M, M], [M, M]]);
    }
  }
  c.style.left = Math.round(Math.max(M, x)) + 'px';
  c.style.top = Math.round(Math.max(M, y)) + 'px';
}

// One loop while the tour is open: it keeps the lit box on its part while the page scrolls,
// resizes or draws late (the gap map and the Q2 panel render after their modules load).
function frame() {
  if (!S) return;
  var step = S.def.steps[S.i], now = Date.now();
  if (!S.list.length || S.list.some(function (e) { return !e.isConnected; }) || now - S.seen > 400) {
    var fresh = targets(step, S.panel), cl = fresh.map(clipsOf), g = bbox(fresh, 0, cl), gh = g ? g.b - g.t : 0;
    S.list = fresh; S.clips = cl; S.seen = now;
    // Scroll when the part first shows, and again when it grows a lot in the first moments of
    // the step (a drawer or a list that fills in late).
    if (fresh.length && (!S.shown || (now - S.t0 < 1600 && gh > S.gh + 60))) { reveal(fresh, cl); S.shown = true; S.gh = gh; }
  }
  var b = bbox(S.list, step.pad == null ? 8 : step.pad, S.clips), W = root.clientWidth, H = innerHeight;
  var key = b ? [b.l, b.t, b.r, b.b].map(Math.round).join() : 'none';
  key += '|' + W + 'x' + H + '|' + S.card.offsetHeight;
  if (key !== S.memo) {
    S.memo = key;
    var h = S.hole.style;
    S.root.classList.toggle('none', !b);
    if (b) {
      h.left = Math.round(b.l) + 'px'; h.top = Math.round(b.t) + 'px';
      h.width = Math.round(b.r - b.l) + 'px'; h.height = Math.round(b.b - b.t) + 'px';
    }
    place(b);
  }
  S.raf = requestAnimationFrame(frame);
}

function el(tag, cls, html) {
  var e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function show(i) {
  var def = S.def, n = def.steps.length;
  if (i < 0 || i >= n) return;
  var first = S.i == null;
  if (!first && S.i !== i) run(def.steps[S.i].after, S.panel);
  S.i = i;
  var step = def.steps[i], c = S.card;
  run(step.before, S.panel);
  var paras = [].concat(step.text || []).map(function (t) { return '<p>' + t + '</p>'; }).join('');
  S.num.textContent = (S.name ? S.name + ' · ' : '') + 'Step ' + (i + 1) + ' of ' + n;
  S.h.innerHTML = step.title || '';
  S.body.innerHTML = paras + (step.limit ? '<p class="tour-lim"><b>Limit:</b> ' + step.limit + '</p>' : '');
  S.prog.innerHTML = def.steps.map(function (s, j) { return '<i' + (j === i ? ' class="on"' : j < i ? ' class="past"' : '') + '></i>'; }).join('');
  S.back.disabled = i === 0;
  S.next.textContent = i === n - 1 ? 'Done' : 'Next';
  // Move the lit box with a short glide (none when the reader asks for less motion).
  S.root.classList.toggle('mv', !reduce.matches);
  clearTimeout(S.mvT);
  S.mvT = setTimeout(function () { if (S) S.root.classList.remove('mv'); }, 420);
  S.list = []; S.clips = []; S.shown = false; S.seen = 0; S.memo = ''; S.t0 = Date.now(); S.gh = 0;
  // The new list and the scroll happen in the next frame, after before() has drawn.
  // Focus: the heading when the tour opens (a screen reader reads the dialog). After that the
  // focus stays on Back or Next, so Enter keeps going, and the live region reads the new step.
  var a = doc.activeElement;
  if (first) S.h.focus();
  else {
    if (!((a === S.next || a === S.back) && !a.disabled)) S.next.focus();
    S.live.textContent = '';
    setTimeout(function () { if (S) S.live.textContent = S.num.textContent + '. ' + S.h.textContent + '. ' + S.body.textContent; }, 60);
  }
  c.scrollTop = 0;
}

function trap(e) {
  var f = Array.prototype.filter.call(S.card.querySelectorAll('button, [href]'), function (x) { return !x.disabled; });
  var first = f[0], last = f[f.length - 1];
  if (!S.card.contains(doc.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
}
function onKey(e) {
  if (!S) return;
  var k = e.key, tag = (e.target && e.target.tagName) || '';
  if (k === 'Escape') close();
  else if (k === 'ArrowRight' && tag !== 'INPUT') show(S.i + 1);
  else if (k === 'ArrowLeft' && tag !== 'INPUT') show(S.i - 1);
  else if (k === 'Tab') { trap(e); return; }
  else if (k === '/') {}
  else return;
  // The page's own keys (Esc clears a selection, "/" goes to search) wait while the tour is open.
  e.preventDefault(); e.stopPropagation();
}

function start(key, btn) {
  if (S) close();
  var def = defs[key], panel = doc.getElementById('panel-' + key);
  if (!def || !panel || !def.steps || !def.steps.length) return;
  var r = el('div', 'tour-root none');
  var hole = el('div', 'tour-hole');
  var veil = el('div', 'tour-veil');
  hole.setAttribute('aria-hidden', 'true'); veil.setAttribute('aria-hidden', 'true');
  var card = el('div', 'tour-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'tour-h');
  card.setAttribute('aria-describedby', 'tour-b');
  card.innerHTML = '<div class="tour-top"><p class="tour-n"></p><button type="button" class="tour-x" aria-label="Close the tour">×</button></div>' +
    '<h2 id="tour-h" tabindex="-1"></h2><div id="tour-b" class="tour-b"></div>' +
    '<div class="tour-foot"><div class="tour-prog" aria-hidden="true"></div>' +
    '<div class="tour-nav"><button type="button" class="tour-back">Back</button><button type="button" class="tour-next">Next</button></div></div>' +
    '<p class="vh" aria-live="polite"></p>';
  r.appendChild(veil); r.appendChild(hole); r.appendChild(card);
  S = {key: key, def: def, panel: panel, btn: btn, root: r, hole: hole, card: card, i: null, list: [], memo: '',
    num: card.querySelector('.tour-n'), h: card.querySelector('#tour-h'), body: card.querySelector('.tour-b'),
    prog: card.querySelector('.tour-prog'), back: card.querySelector('.tour-back'), next: card.querySelector('.tour-next'),
    live: card.querySelector('[aria-live]'), inert: [], sx: scrollX, sy: scrollY};
  // The card names the panel as its tab does ("Seedling findings · Step 2 of 6"); def.title is the
  // fallback when there is no tab.
  var tab = doc.getElementById('tab-' + key);
  S.name = (tab && tab.textContent.replace(/\s+/g, ' ').trim()) || def.title || '';
  // Everything else on the page is inert while the tour is open: no clicks, no focus, no screen reader.
  Array.prototype.forEach.call(doc.body.children, function (c) {
    if (c.tagName === 'SCRIPT' || c.inert || c.hasAttribute('inert')) return;
    c.inert = true; c.setAttribute('inert', ''); S.inert.push(c);
  });
  doc.body.appendChild(r);
  root.classList.add('touring');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  S.back.addEventListener('click', function () { show(S.i - 1); });
  S.next.addEventListener('click', function () { if (S.i === S.def.steps.length - 1) close(); else show(S.i + 1); });
  card.querySelector('.tour-x').addEventListener('click', close);
  addEventListener('keydown', onKey, true);
  run(def.start, panel);
  show(0);
  S.raf = requestAnimationFrame(frame);
}

function close() {
  if (!S) return;
  var s = S;
  cancelAnimationFrame(s.raf);
  clearTimeout(s.mvT);
  removeEventListener('keydown', onKey, true);
  S = null;
  run(s.def.steps[s.i].after, s.panel);
  run(s.def.end, s.panel);
  s.inert.forEach(function (c) { c.inert = false; c.removeAttribute('inert'); });
  s.root.parentNode.removeChild(s.root);
  root.classList.remove('touring');
  // Back to where the reader was: the page scroll from before the tour, then the focus on
  // "Want help?" (without a second scroll).
  scrollTo(s.sx, s.sy);
  if (s.btn) {
    s.btn.setAttribute('aria-expanded', 'false');
    try { s.btn.focus({preventScroll: true}); } catch (e) { s.btn.focus(); }
  }
}

window.Q1Tour = {add: add, start: start, close: close, open: function () { return S ? S.key : null; }};
})();
