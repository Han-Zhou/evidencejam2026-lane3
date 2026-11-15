// Q1 prototype, rank 1: the expanded graph view. app.js loads this file on the
// first click on "Expand". The dialog shows the panel's own layered SVG, large.
// The same <svg> element moves into the dialog while it is open and goes back on
// close, so its click and key handlers, its ids and the shared index stay as they
// are. A blank SVG of the same size holds its place in the panel. Zoom and pan
// change only the viewBox. Selection, filters, the status line and the drawer
// are shared with the panel. Vanilla JS, no external requests.
(function () {
'use strict';
var doc = document, root = doc.documentElement, NS = 'http://www.w3.org/2000/svg';
var still = matchMedia('(prefers-reduced-motion: reduce)');
var KMIN = 0.2, KMAX = 5, PAD = 16;

function h(tag, cls, par, txt) {
  var e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  if (par) par.appendChild(e);
  return e;
}
function btn(cls, par, txt, label) {
  var b = h('button', cls, par, txt);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  return b;
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function r2(v) { return Math.round(v * 100) / 100; }

// ---------- view: k is screen px per SVG unit, (cx, cy) is the SVG point at the canvas centre ----------
function size(X) { return [X.cv.clientWidth, X.cv.clientHeight]; }
function setView(X, k, cx, cy) {
  var S = size(X);
  X.k = k; X.cx = cx; X.cy = cy;
  if (!X.p.xopen || !S[0] || !S[1]) return;
  X.p.svg.setAttribute('viewBox', [cx - S[0] / k / 2, cy - S[1] / k / 2, S[0] / k, S[1] / k].map(r2).join(' '));
  X.zl.textContent = Math.round(k * 100) + '%';
}
function view(X, k, cx, cy, anim) {
  cancelAnimationFrame(X.va);
  clearTimeout(X.vt);
  if (!anim || still.matches) { setView(X, k, cx, cy); return; }
  var k0 = X.k, x0 = X.cx, y0 = X.cy, t0 = performance.now();
  X.va = requestAnimationFrame(function step(now) {
    var t = clamp((now - t0) / 240, 0, 1), e = 1 - Math.pow(1 - t, 3);
    setView(X, k0 + (k - k0) * e, x0 + (cx - x0) * e, y0 + (cy - y0) * e);
    if (t < 1) X.va = requestAnimationFrame(step);
  });
  // If frames stall (a background tab), still end at the target view.
  X.vt = setTimeout(function () { cancelAnimationFrame(X.va); setView(X, k, cx, cy); }, 300);
}
// Zoom by f and keep the SVG point under the canvas pixel (mx, my) where it is.
function zoomAt(X, f, mx, my, anim) {
  var S = size(X), k = clamp(X.k * f, KMIN, KMAX), dx = mx - S[0] / 2, dy = my - S[1] / 2;
  view(X, k, X.cx + dx / X.k - dx / k, X.cy + dy / X.k - dy / k, anim);
}
function zoomMid(X, f) { var S = size(X); zoomAt(X, f, S[0] / 2, S[1] / 2, true); }
function pan(X, dx, dy, anim) { view(X, X.k, X.cx - dx / X.k, X.cy - dy / X.k, anim); }
// Fit: the whole SVG (graph and legend) in view, centred.
function fit(X, anim) {
  var S = size(X), b = X.vb;
  view(X, clamp(Math.min((S[0] - 2 * PAD) / b[2], (S[1] - 2 * PAD) / b[3]), KMIN, 2), b[0] + b[2] / 2, b[1] + b[3] / 2, anim);
}

// ---------- pointer, wheel and keys on the canvas ----------
// A click on a node or a chip goes to app.js's handlers on the SVG, as on the page.
// A drag (from anywhere) pans; two fingers pinch. A drag or a pinch is not a click.
function controls(X) {
  var cv = X.cv, ptr = {}, D = null, pinch = null;
  function two() { var ids = Object.keys(ptr); return ids.length > 1 ? [ptr[ids[0]], ptr[ids[1]]] : null; }
  cv.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    ptr[e.pointerId] = [e.clientX, e.clientY];
    var t = two();
    if (t) {
      pinch = {d: Math.hypot(t[0][0] - t[1][0], t[0][1] - t[1][1]) || 1, k: X.k};
      D = null; X.moved = true;
      Object.keys(ptr).forEach(function (i) { try { cv.setPointerCapture(+i); } catch (err) {} });
      return;
    }
    D = {x: e.clientX, y: e.clientY, cx: X.cx, cy: X.cy, on: false};
    X.moved = false;
  });
  cv.addEventListener('pointermove', function (e) {
    if (!ptr[e.pointerId]) return;
    ptr[e.pointerId] = [e.clientX, e.clientY];
    var t = two(), r = cv.getBoundingClientRect();
    if (pinch) {
      if (t) zoomAt(X, pinch.k * Math.hypot(t[0][0] - t[1][0], t[0][1] - t[1][1]) / pinch.d / X.k, (t[0][0] + t[1][0]) / 2 - r.left, (t[0][1] + t[1][1]) / 2 - r.top);
      return;
    }
    if (!D) return;
    var dx = e.clientX - D.x, dy = e.clientY - D.y;
    if (!D.on) {
      if (dx * dx + dy * dy < 16) return;
      D.on = X.moved = true;
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      cv.classList.add('panning');
    }
    setView(X, X.k, D.cx - dx / X.k, D.cy - dy / X.k);
  });
  function up(e) {
    if (!ptr[e.pointerId]) return;
    delete ptr[e.pointerId];
    if (!two()) pinch = null;
    if (Object.keys(ptr).length) return;
    D = null;
    cv.classList.remove('panning');
    setTimeout(function () { X.moved = false; }, 0);
  }
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  // Capture phase: the click stops here, before it reaches the SVG's own click handler.
  cv.addEventListener('click', function (e) { if (X.moved) { e.stopPropagation(); e.preventDefault(); X.moved = false; } }, true);
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = cv.getBoundingClientRect(), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(X, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
  }, {passive: false});
  // Keys: + − zoom, 0 fits, arrows pan. Enter and Space on a node or a chip are app.js's.
  cv.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var P = {ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80]}[e.key];
    if (e.key === '+' || e.key === '=') zoomMid(X, 1.25);
    else if (e.key === '-' || e.key === '_') zoomMid(X, 0.8);
    else if (e.key === '0') fit(X, true);
    else if (P) pan(X, P[0], P[1], true);
    else return;
    e.preventDefault();
  });
  // Tab to a node or a chip outside the view: pan so it shows in the centre.
  cv.addEventListener('focusin', function (e) {
    var fv = true;
    try { fv = e.target.matches(':focus-visible'); } catch (err) {}
    if (e.target === cv || !fv) return;
    var r = e.target.getBoundingClientRect(), c = cv.getBoundingClientRect();
    if (r.left >= c.left && r.right <= c.right && r.top >= c.top && r.bottom <= c.bottom) return;
    pan(X, c.left + c.width / 2 - r.left - r.width / 2, c.top + c.height / 2 - r.top - r.height / 2, true);
  });
  // Keep the same centre and zoom when the canvas changes size (the drawer column opens or closes).
  if (window.ResizeObserver) new ResizeObserver(function () { setView(X, X.k, X.cx, X.cy); }).observe(cv);
}

// ---------- the dialog ----------
function create(p) {
  var k = p.k, name = k === 'findings' ? 'Findings' : 'Network', X = {p: p, k: 1, cx: 0, cy: 0}, v = p.svg.viewBox.baseVal;
  // The full viewBox (x, y, width, height). It need not start at 0 0 (the legend can sit above y = 0).
  X.vb0 = p.svg.getAttribute('viewBox');
  X.vb = [v.x, v.y, v.width, v.height];
  // The blank SVG that keeps the panel box at its size while the graph is in the dialog.
  X.ph = doc.createElementNS(NS, 'svg');
  ['viewBox', 'width', 'height', 'style'].forEach(function (a) { if (p.svg.hasAttribute(a)) X.ph.setAttribute(a, p.svg.getAttribute(a)); });
  X.ph.setAttribute('class', 'graph');
  X.ph.setAttribute('aria-hidden', 'true');
  var ov = X.ov = h('div', 'xv');
  ov.hidden = true;
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'xvh-' + k);
  var top = h('div', 'xv-top', ov), hd = h('h2', 'xv-h', top, name + ' ');
  hd.id = 'xvh-' + k;
  h('span', 'muted', hd, 'expanded');
  X.slot = h('div', 'xv-stat', top);
  h('p', 'xv-hint', top, 'Scroll or pinch to zoom. Drag to pan.');
  var z = h('div', 'xv-zoom', top);
  z.setAttribute('role', 'group'); z.setAttribute('aria-label', 'Zoom');
  btn('', z, '−', 'Zoom out').addEventListener('click', function () { zoomMid(X, 1 / 1.3); });
  X.zl = h('span', 'xv-zl', z, '100%');
  btn('', z, '+', 'Zoom in').addEventListener('click', function () { zoomMid(X, 1.3); });
  btn('', z, 'Fit', 'Fit the graph to the screen').addEventListener('click', function () { fit(X, true); });
  btn('xv-x', top, '×', 'Close expanded view').addEventListener('click', function () { close(X); });
  var cv = X.cv = h('div', 'xv-cv', ov);
  cv.tabIndex = 0;
  cv.setAttribute('role', 'group');
  cv.setAttribute('aria-label', 'Zoomable graph of the ' + name.toLowerCase() +
    '. Plus and minus keys zoom, 0 fits, arrow keys pan. Tab moves through nodes and chips; Enter selects.');
  // Esc closes from anywhere (also with focus on the body), before app.js's own Esc handler.
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !p.xopen) return;
    e.preventDefault(); e.stopPropagation();
    close(X);
  }, true);
  // Inside the panel, so clicks in the drawer reach the panel's own handlers.
  p.el.appendChild(ov);
  controls(X);
  return X;
}

function open(p, opener) {
  var X = p.xv || (p.xv = create(p)), dcol = p.drawer.parentNode, st = p.stat;
  if (p.xopen) return;
  X.btn = opener;
  // The graph, the drawer and the status line move into the dialog while it is open.
  X.back = [[dcol, dcol.parentNode, dcol.nextSibling], [st, st.parentNode, st.nextSibling]];
  p.svg.parentNode.replaceChild(X.ph, p.svg);
  X.cv.appendChild(p.svg);
  X.ov.appendChild(dcol);
  X.slot.appendChild(st);
  X.ov.hidden = false;
  root.classList.add('xvopen');
  p.xopen = true;
  // Everything outside the dialog is inert while it is open.
  X.inert = [];
  for (var n = X.ov; n.parentNode && n !== doc.body; n = n.parentNode) {
    Array.prototype.forEach.call(n.parentNode.children, function (c) {
      if (c !== n && !c.inert && !/SCRIPT|STYLE|LINK/.test(c.tagName)) { c.inert = true; X.inert.push(c); }
    });
  }
  fit(X, false);
  X.cv.focus({preventScroll: true});
}
function close(X) {
  var p = X.p;
  cancelAnimationFrame(X.va);
  clearTimeout(X.vt);
  X.inert.forEach(function (c) { c.inert = false; });
  p.svg.setAttribute('viewBox', X.vb0);
  X.ph.parentNode.replaceChild(p.svg, X.ph);
  X.back.forEach(function (b) { b[1].insertBefore(b[0], b[2]); });
  X.ov.hidden = true;
  root.classList.remove('xvopen');
  p.xopen = false;
  if (X.btn) X.btn.focus();
}

window.Q1X = {open: open};
})();
