// Copy image of the graph (snap.js). Loaded on the first click on "Copy image".
// copy(p, btn) clones the panel SVG and writes the computed look of each element into the clone
// (theme colours, highlight and fade, filters, lens, search dims), so the clone needs no style sheet.
// It draws the clone on a canvas on the graph box colour, at 2x or more, and puts the PNG on the
// clipboard. Without the Clipboard API, or when the browser refuses the write, it downloads the PNG.
(function () {
'use strict';
var doc = document, W = window;
// Inherited properties: written only where the value differs from the parent's value.
var INH = ['color', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'paint-order', 'marker-start', 'marker-mid',
  'marker-end', 'visibility', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant-numeric',
  'letter-spacing', 'word-spacing', 'text-anchor'];
// Other properties, with their initial value: written where the value is not the initial one.
var OWN = {'opacity': '1', 'dominant-baseline': 'auto', 'clip-path': 'none', 'filter': 'none', 'vector-effect': 'none',
  'stop-color': 'rgb(0, 0, 0)', 'stop-opacity': '1', 'text-decoration-line': 'none'};
// Content of <defs> and <symbol> draws through <use> and inherits from it: it stays as it is.
// Markers, gradients, patterns, clip paths, masks and filters take styles from where they are.
var TPL = /^(defs|symbol)$/, RES = /^(marker|pattern|linearGradient|radialGradient|clipPath|mask|filter)$/;
var live = doc.createElement('div'), st = doc.createElement('style');
live.setAttribute('role', 'status');
live.setAttribute('aria-live', 'polite');
live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
doc.body.appendChild(live);
// While the styles are read: no transitions, so the values are the end state.
st.textContent = '.q1-snap,.q1-snap *{transition:none!important;animation:none!important}';
doc.head.appendChild(st);

// url("http://host/page#id") from the computed style -> url(#id), so it resolves inside the image.
function local(v) { return v.indexOf('url(') < 0 ? v : v.replace(/url\(\s*(['"]?)[^'")]*?(#[^'")]+)\1\s*\)/g, 'url($2)'); }

function walk(o, c, ps, tpl) {
  var s = getComputedStyle(o), n = o.localName, i, k, v, oc, cc;
  tpl = RES.test(n) ? false : tpl || TPL.test(n);
  if (!tpl) {
    if (ps && s.display === 'none') { c.parentNode.removeChild(c); return; }
    for (i = 0; i < INH.length; i++) {
      k = INH[i]; v = s.getPropertyValue(k);
      if (v && (!ps || v !== ps.getPropertyValue(k))) c.style.setProperty(k, local(v));
    }
    for (k in OWN) { v = s.getPropertyValue(k); if (v && v !== OWN[k]) c.style.setProperty(k, local(v)); }
  }
  oc = o.children; cc = [].slice.call(c.children);
  for (i = 0; i < oc.length; i++) walk(oc[i], cc[i], s, tpl);
}

// Background colours from the SVG up to the first opaque one, outermost first.
function backs(el) {
  var out = [], b;
  for (; el && el.nodeType === 1; el = el.parentNode) {
    b = getComputedStyle(el).backgroundColor;
    if (!b || /^transparent$|^rgba\(.*,\s*0\)$/.test(b)) continue;
    out.unshift(b);
    if (b.indexOf('rgba') !== 0) return out;
  }
  out.unshift('#fff');
  return out;
}

// Returns a Promise for the PNG blob. The styles are read now, inside the click.
function render(svg) {
  var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, pad = 16,
    w = r.width || vb.width, h = r.height || vb.height, s = Math.max(2, W.devicePixelRatio || 1),
    a = doc.activeElement, c = svg.cloneNode(true), bg = backs(svg), xml;
  // Canvas area limit of iOS Safari (16.7 megapixels).
  while (s > 1 && (w + 2 * pad) * (h + 2 * pad) * s * s > 16e6) s -= .5;
  // No focus ring in the image.
  if (a && a !== svg && svg.contains(a)) a.blur(); else a = null;
  svg.classList.add('q1-snap');
  try {
    c.removeAttribute('style');
    walk(svg, c, null, false);
  } finally {
    svg.classList.remove('q1-snap');
    if (a) a.focus({preventScroll: true});
  }
  c.setAttribute('width', w * s);
  c.setAttribute('height', h * s);
  xml = new XMLSerializer().serializeToString(c);
  return new Promise(function (ok, no) {
    var img = new Image();
    img.onload = function () {
      var cv = doc.createElement('canvas'), x, i;
      cv.width = Math.round((w + 2 * pad) * s);
      cv.height = Math.round((h + 2 * pad) * s);
      x = cv.getContext('2d');
      for (i = 0; i < bg.length; i++) { x.fillStyle = bg[i]; x.fillRect(0, 0, cv.width, cv.height); }
      x.drawImage(img, pad * s, pad * s, w * s, h * s);
      cv.toBlob(function (b) { if (b) ok(b); else no(new Error('toBlob')); }, 'image/png');
    };
    img.onerror = no;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  });
}

function copy(p, btn) {
  if (btn._snap) return;
  btn._snap = 1;
  var lab = btn.innerHTML, name = 'q1-' + p.k + '-graph.png', png, job, CI = W.ClipboardItem;
  btn.style.minWidth = btn.offsetWidth + 'px';
  btn.setAttribute('aria-disabled', 'true');
  live.textContent = '';
  try { png = render(p.svg); } catch (e) { png = Promise.reject(e); }
  function save() {
    return png.then(function (b) {
      var a = doc.createElement('a'), u = URL.createObjectURL(b);
      a.href = u; a.download = name; a.hidden = true;
      doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(u); }, 4e4);
      return ['Downloaded', 'Could not copy to the clipboard. The graph image was downloaded as ' + name + '.'];
    });
  }
  // The write starts inside the click, with a Promise for the blob (Safari needs this).
  try {
    if (CI.supports && !CI.supports('image/png')) throw 0;
    job = navigator.clipboard.write([new CI({'image/png': png})]).then(function () {
      return ['Copied', 'Graph image copied to the clipboard.'];
    }, save);
  } catch (e) { job = save(); }
  job.then(null, function () { return ['Copy failed', 'Could not make the graph image.']; }).then(function (m) {
    btn.textContent = m[0];
    live.textContent = m[1];
    setTimeout(function () {
      btn.innerHTML = lab;
      btn.style.minWidth = '';
      if (!btn.getAttribute('style')) btn.removeAttribute('style');
      btn.removeAttribute('aria-disabled');
      btn._snap = 0;
    }, 2000);
  });
}

// app.js calls copy() after need('snap') resolves, which is after the click on the first use.
// From now on, take the click first (capture phase), so the write stays inside the click.
// app.js's own call that follows finds the button busy and does nothing.
doc.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="copy"]'), P = W.Q1 && W.Q1.P, k;
  if (b && P) for (k in P) if (P[k].el && P[k].el.contains(b)) copy(P[k], b);
}, true);

W.Q1Snap = {copy: copy};
})();
