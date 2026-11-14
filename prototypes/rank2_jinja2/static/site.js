/* Q1 prototype, rank 2: tabs, hover cards, drawer, search, lenses, filters,
   matrix toggle, table sort and paging. No framework, no network. All text it
   shows is cloned from the page (tables, <template> cards) or the JSON island. */
(function () {
  'use strict';
  var doc = document;
  var DIRS = ['increase', 'decrease', 'mixed', 'no_effect', 'unclear'];
  var RANK = { very_low: 1, low: 2, moderate: 3, high: 4 };
  var KEY = { node: 'n', edge: 'e', finding: 'e', gap: 'g', paper: 'p', claim: 'c' };
  var PAGE = 25;
  var panels = {}, current = 'findings', tabList = [];
  var hc = doc.getElementById('hovercard'), hcTimer = 0, hcKey = null;
  var smooth = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  function $$(s, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(s)); }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function low(s) { return String(s || '').toLowerCase(); }
  function lab(P, id) { var n = P.data.nodes[id]; return n ? n.l : id; }
  function edgeLabel(P, id) {
    var e = P.data.edges[id];
    if (e.te) { var t = P.data.edges[e.te]; return lab(P, e.s) + ' → effect of ' + lab(P, t.s) + ' → ' + lab(P, t.t); }
    return lab(P, e.s) + ' → ' + lab(P, e.t);
  }
  function docLink(d, doi) {
    if (doi) { var a = el('a', null, doi); a.href = 'https://doi.org/' + doi; return a; }
    var s = el('span', 'mono', d); s.title = 'No DOI in the record'; return s;
  }

  /* ---------------------------------------------------------------- setup */
  function setup(sec) {
    var P = { sec: sec, key: sec.id, pre: sec.getAttribute('data-pre') };
    P.data = JSON.parse(doc.getElementById(P.pre + '-data').textContent);
    P.svg = sec.querySelector('svg.graph');
    P.stage = sec.querySelector('.stage');
    P.drawer = sec.querySelector('.drawer');
    P.dbody = P.drawer.querySelector('.drawer-body');
    P.dh = P.drawer.querySelector('.drawer-h');
    P.dx = P.drawer.querySelector('.drawer-x');
    P.empty = P.dbody.innerHTML;
    P.q = sec.querySelector('.q');
    P.res = sec.querySelector('.results');
    P.status = sec.querySelector('.status');
    P.more = sec.querySelector('.more');
    P.st = { dirs: {}, minc: 0, gaps: true, lens: 'all' };
    DIRS.forEach(function (d) { P.st.dirs[d] = true; });
    P.match = null; P.pinned = null; P.showAll = false;
    P.marks = {};
    $$('[data-k]', P.stage).forEach(function (n) {
      var k = n.getAttribute('data-k'); (P.marks[k] = P.marks[k] || []).push(n);
    });
    P.mem = $$('.mem', P.svg);
    P.itemRows = {};
    $$('.t-items tbody tr', sec).forEach(function (r) {
      P.itemRows[r.getAttribute('data-edge-id') || r.getAttribute('data-finding-id')] = r;
    });
    P.gapRows = {};
    $$('.t-gaps tbody tr', sec).forEach(function (r) { P.gapRows[r.getAttribute('data-gap-id')] = r; });
    // claims: one row each in the claims table (cells: claim, direction, grade, quote, paper)
    P.claimTable = sec.querySelector('.t-claims');
    P.claims = {}; P.claimDoc = {}; P.claimText = {};
    Object.keys(P.data.edges).forEach(function (id) { P.data.edges[id].cl = []; });
    $$('tr[data-d]', P.claimTable).forEach(function (r) {
      var c = r.id.slice(P.pre.length + 1), g = r.parentNode.getAttribute('data-g');
      P.claims[c] = r;
      P.claimDoc[c] = r.getAttribute('data-doc') || r.cells[4].firstElementChild.textContent;
      P.claimText[c] = low(r.cells[0].textContent + ' ' + r.cells[3].textContent + ' ' + P.claimDoc[c]);
      if (g && P.data.edges[g.slice(2)]) P.data.edges[g.slice(2)].cl.push(c);
    });
    // papers: title, year, DOI from the papers table
    P.paperRows = $$('.t-papers tbody tr', sec);
    P.data.papers = {};
    P.paperRows.forEach(function (r) {
      var a = r.cells[2].querySelector('a');
      P.data.papers[r.getAttribute('data-doc')] = [r.cells[0].textContent, r.cells[1].textContent, a ? a.textContent : null];
    });
    P.intRows = $$('.t-int tbody tr', sec);
    P.lens = {};
    if (P.data.lens) Object.keys(P.data.lens).forEach(function (k) { P.lens[k] = new Set(P.data.lens[k]); });
    P.inc = {};
    function inc(n) { return (P.inc[n] = P.inc[n] || { in: [], out: [] }); }
    Object.keys(P.data.edges).forEach(function (id) {
      var e = P.data.edges[id]; inc(e.s).out.push('e:' + id); if (e.t) inc(e.t).in.push('e:' + id);
    });
    Object.keys(P.data.gaps).forEach(function (id) {
      var g = P.data.gaps[id]; inc(g.s).out.push('g:' + id); inc(g.t).in.push('g:' + id);
    });
    wire(P);
    return P;
  }

  /* ---------------------------------------------------------------- highlight (L2 focus + context) */
  function clearHL(P) {
    P.svg.classList.remove('hl-on');
    $$('.is-hl, .is-in, .is-out', P.svg).forEach(function (n) { n.classList.remove('is-hl', 'is-in', 'is-out'); });
  }
  function addCls(P, k, c) { (P.marks[k] || []).forEach(function (n) { n.classList.add(c); }); }
  function highlight(P, k) {
    clearHL(P);
    var D = P.data, t = k[0], id = k.slice(2), keys = [k];
    function ends(o) { keys.push('n:' + o.s); if (o.t) keys.push('n:' + o.t); }
    if (t === 'e') {
      var e = D.edges[id]; ends(e);
      if (e.te) { keys.push('e:' + e.te); ends(D.edges[e.te]); }
    } else if (t === 'g') {
      ends(D.gaps[id]);
    } else if (t === 'n') {
      var I = P.inc[id] || { in: [], out: [] };
      I.in.concat(I.out).forEach(function (x) {
        keys.push(x);
        var o = x[0] === 'e' ? D.edges[x.slice(2)] : D.gaps[x.slice(2)];
        ends(o); if (o.te) keys.push('e:' + o.te);
      });
      if (D.nodes[id] && D.nodes[id].k === 'condition') {
        I.in.forEach(function (x) { addCls(P, x, 'is-in'); });
        I.out.forEach(function (x) { addCls(P, x, 'is-out'); });
      }
      P.mem.forEach(function (m) {
        var ids = m.getAttribute('data-mem').split(' ');
        if (ids.indexOf(id) >= 0) { m.classList.add('is-hl'); keys.push('n:' + ids[0], 'n:' + ids[1]); }
      });
    }
    P.svg.classList.add('hl-on');
    keys.forEach(function (x) { addCls(P, x, 'is-hl'); });
  }

  /* ---------------------------------------------------------------- hover card (L3) */
  function showCard(P, k, x, y, rect) {
    var t = doc.getElementById(P.pre + '-t-' + k);
    if (!t) return;
    hc.textContent = '';
    hc.appendChild(t.content.cloneNode(true));
    hc.hidden = false;
    var w = hc.offsetWidth, h = hc.offsetHeight, vw = innerWidth, vh = innerHeight, left, top;
    if (rect) {
      left = rect.left; top = rect.bottom + 8;
      if (top + h > vh - 8) top = rect.top - h - 8;
      if (top < 8) { // no room above or below: put it beside the element
        top = rect.top + rect.height / 2 - h / 2;
        left = rect.right + w + 20 < vw ? rect.right + 12 : rect.left - w - 12;
      }
    } else {
      left = x + 16; top = y + 16;
      if (left + w > vw - 8) left = x - w - 16;
      if (top + h > vh - 8) top = y - h - 16;
    }
    hc.style.left = Math.max(8, Math.min(left, vw - w - 8)) + 'px';
    hc.style.top = Math.max(8, Math.min(top, vh - h - 8)) + 'px';
  }
  function hideCard() { clearTimeout(hcTimer); hc.hidden = true; hcKey = null; }

  /* ---------------------------------------------------------------- drawer (L4/L5) */
  function claimCard(P, c) {
    var r = P.claims[c], art = el('article', 'claim');
    art.setAttribute('data-cid', c);
    var cc = r.cells[0].cloneNode(true), meta = cc.querySelector('small');
    cc.removeChild(meta);
    var p1 = el('p', 'ctext');
    while (cc.firstChild) p1.appendChild(cc.firstChild);
    art.appendChild(p1);
    var p2 = el('p', 'cmeta'), dl = el('span', 'dl ' + r.cells[1].className);
    dl.innerHTML = r.cells[1].innerHTML; // our own cell: glyph + direction word
    p2.appendChild(dl);
    p2.appendChild(doc.createTextNode(' · Grade: ' + r.cells[2].textContent + ' · ' + meta.textContent + ' · '));
    p2.appendChild(el('span', 'mono', c));
    art.appendChild(p2);
    art.appendChild(el('blockquote', null, r.cells[3].textContent));
    return art;
  }
  function paperHead(P, d, n) {
    var pm = P.data.papers[d], sec = el('section', 'paper');
    sec.appendChild(el('h4', null, pm[0]));
    var meta = el('p', 'pmeta');
    meta.appendChild(doc.createTextNode((pm[1] || '–') + ' · '));
    meta.appendChild(docLink(d, pm[2]));
    if (n) meta.appendChild(doc.createTextNode(' · ' + n + (n === 1 ? ' claim' : ' claims')));
    sec.appendChild(meta);
    return sec;
  }
  function claimsByPaper(P, cids) {
    var frag = doc.createDocumentFragment(), by = {}, order = [];
    cids.forEach(function (c) {
      var d = P.claimDoc[c];
      if (!by[d]) { by[d] = []; order.push(d); }
      by[d].push(c);
    });
    var first = order.slice();
    order.sort(function (a, b) { return by[b].length - by[a].length || first.indexOf(a) - first.indexOf(b); });
    frag.appendChild(el('p', 'lbl', 'Claims by paper (' + order.length + (order.length === 1 ? ' paper' : ' papers') + ')'));
    order.forEach(function (d) {
      var sec = paperHead(P, d, by[d].length);
      by[d].forEach(function (c) { sec.appendChild(claimCard(P, c)); });
      frag.appendChild(sec);
    });
    return frag;
  }
  function paperView(P, d) {
    var pm = P.data.papers[d], frag = doc.createDocumentFragment(), card = el('div', 'card');
    card.appendChild(el('p', 'card-k', 'Paper'));
    card.appendChild(el('p', 'card-t', pm[0]));
    var meta = el('p', 'card-n');
    meta.appendChild(doc.createTextNode((pm[1] || '–') + ' · '));
    meta.appendChild(docLink(d, pm[2]));
    card.appendChild(meta);
    frag.appendChild(card);
    var done = {};
    Object.keys(P.data.edges).forEach(function (id) {
      var cl = P.data.edges[id].cl.filter(function (c) { return P.claimDoc[c] === d; });
      if (!cl.length) return;
      var sec = el('section', 'paper'), h = el('h4'), b = el('button', 'mini', edgeLabel(P, id));
      b.type = 'button'; b.setAttribute('data-k', 'e:' + id);
      h.appendChild(b); sec.appendChild(h);
      cl.forEach(function (c) { done[c] = 1; sec.appendChild(claimCard(P, c)); });
      frag.appendChild(sec);
    });
    var rest = Object.keys(P.claims).filter(function (c) { return P.claimDoc[c] === d && !done[c]; });
    if (rest.length) {
      var sec = el('section', 'paper');
      sec.appendChild(el('h4', null, 'Interaction claims (listed, not pooled)'));
      rest.forEach(function (c) { sec.appendChild(claimCard(P, c)); });
      frag.appendChild(sec);
    }
    return frag;
  }
  function groupOf(P, c) {
    var ids = Object.keys(P.data.edges);
    for (var i = 0; i < ids.length; i++) if (P.data.edges[ids[i]].cl.indexOf(c) >= 0) return 'e:' + ids[i];
    return null;
  }
  function unpin(P) {
    $$('.is-pin', P.sec).forEach(function (n) { n.classList.remove('is-pin'); });
  }
  function reveal(P, row) {
    var det = row.closest('details');
    if (det) det.open = true;
    if (row.hidden && row.closest('.t-claims')) { P.showAll = true; apply(P); }
    row.classList.add('is-pin');
    row.scrollIntoView({ block: 'center', behavior: smooth });
  }
  function pin(P, k, o) {
    o = o || {};
    var t = k[0], id = k.slice(2);
    if (t === 'c') {
      var g = groupOf(P, id);
      if (!g) { if (P.claims[id]) reveal(P, P.claims[id]); return; }
      pin(P, g, o);
      var card = P.dbody.querySelector('[data-cid="' + id + '"]');
      if (card) { card.classList.add('is-target'); card.scrollIntoView({ block: 'nearest' }); }
      return;
    }
    var frag;
    if (t === 'p') {
      if (!P.data.papers[id]) return;
      frag = paperView(P, id);
    } else {
      var tp = doc.getElementById(P.pre + '-t-' + k);
      if (!tp) return;
      frag = tp.content.cloneNode(true);
    }
    hideCard();
    P.dbody.textContent = '';
    P.dbody.appendChild(frag);
    if (t === 'e') P.dbody.appendChild(claimsByPaper(P, P.data.edges[id].cl));
    P.dbody.scrollTop = 0; P.drawer.scrollTop = 0;
    P.dx.hidden = false;
    P.drawer.classList.add('is-open');
    unpin(P);
    (P.marks[k] || []).forEach(function (n) { n.classList.add('is-pin'); });
    var row = t === 'e' ? P.itemRows[id] : t === 'g' ? P.gapRows[id] : null;
    if (row) row.classList.add('is-pin');
    P.pinned = { k: k, opener: o.opener || null };
    if (!o.nohash) {
      var type = t === 'e' ? (P.key === 'network' ? 'edge' : 'finding') : { n: 'node', g: 'gap', p: 'paper' }[t];
      history.replaceState(null, '', '#' + P.key + '/' + type + '/' + id);
    }
    if (o.focus) {
      var r = P.drawer.getBoundingClientRect();
      if (innerWidth >= 1100 && (r.top < 0 || r.top > innerHeight - 80)) P.drawer.scrollIntoView({ block: 'start', behavior: smooth });
      P.dh.focus({ preventScroll: true });
    }
  }
  function closeDrawer(P) {
    var op = P.pinned && P.pinned.opener;
    unpin(P);
    P.pinned = null;
    P.dbody.innerHTML = P.empty;
    P.dx.hidden = true;
    P.drawer.classList.remove('is-open');
    history.replaceState(null, '', '#' + P.key);
    if (op && doc.contains(op) && op.getClientRects().length) op.focus({ preventScroll: true });
    else P.q.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------- search */
  function search(P) {
    var q = low(P.q.value.trim()), D = P.data;
    if (!q) { P.match = null; P.res.hidden = true; P.res.textContent = ''; apply(P); return; }
    // keys: graph items; claims: claim ids; pdocs: papers whose title matched; docs: pdocs + papers of matched claims
    var M = { keys: new Set(), claims: new Set(), pdocs: new Set(), docs: new Set() };
    var nodes = [], edges = [], papers = [], claims = [];
    Object.keys(D.nodes).forEach(function (id) {
      if (low(D.nodes[id].l).indexOf(q) >= 0) { nodes.push(['n:' + id, D.nodes[id].l]); M.keys.add('n:' + id); }
    });
    Object.keys(D.papers).forEach(function (d) {
      if (low(D.papers[d][0]).indexOf(q) >= 0 || low(d).indexOf(q) >= 0) { papers.push(['p:' + d, D.papers[d][0]]); M.pdocs.add(d); M.docs.add(d); }
    });
    Object.keys(P.claimText).forEach(function (c) {
      if (P.claimText[c].indexOf(q) >= 0) {
        var b = P.claims[c].cells[0].querySelectorAll('b');
        claims.push(['c:' + c, b[0].textContent + ' → ' + b[1].textContent]);
        M.claims.add(c); M.docs.add(P.claimDoc[c]);
      }
    });
    Object.keys(D.edges).forEach(function (id) {
      var e = D.edges[id], L = edgeLabel(P, id);
      if (low(L).indexOf(q) >= 0 || e.cl.some(function (c) { return M.claims.has(c) || M.pdocs.has(P.claimDoc[c]); })) {
        edges.push(['e:' + id, L]); M.keys.add('e:' + id); M.keys.add('n:' + e.s); if (e.t) M.keys.add('n:' + e.t);
      }
    });
    Object.keys(D.gaps).forEach(function (id) {
      var g = D.gaps[id], L = lab(P, g.s) + ' → ' + lab(P, g.t);
      if (low(L).indexOf(q) >= 0) { edges.push(['g:' + id, 'No evidence: ' + L]); M.keys.add('g:' + id); M.keys.add('n:' + g.s); M.keys.add('n:' + g.t); }
    });
    P.match = M;
    var R = P.res, any = false;
    R.textContent = '';
    [['Nodes', nodes], [D.noun === 'edges' ? 'Edges' : 'Findings', edges], ['Papers', papers], ['Claims', claims]].forEach(function (g) {
      R.appendChild(el('h4', null, g[0] + ' (' + g[1].length + ')'));
      if (!g[1].length) return;
      any = true;
      var ul = el('ul');
      g[1].slice(0, 6).forEach(function (x) {
        var li = el('li'), b = el('button', null, x[1]);
        b.type = 'button'; b.setAttribute('data-k', x[0]);
        li.appendChild(b); ul.appendChild(li);
      });
      R.appendChild(ul);
      if (g[1].length > 6) R.appendChild(el('p', 'more-n', '+' + (g[1].length - 6) + ' more'));
    });
    if (!any) R.appendChild(el('p', 'none', 'No matches.'));
    R.hidden = false;
    apply(P);
  }

  /* ---------------------------------------------------------------- lenses, filters, linked views */
  function dim(P, k, on) { (P.marks[k] || []).forEach(function (n) { n.classList.toggle('is-dim', on); }); }
  function apply(P) {
    var D = P.data, S = P.st, M = P.match, shown = 0, bright = new Set();
    function lensOK(k) { return S.lens === 'all' || (P.lens[S.lens] && P.lens[S.lens].has(k)); }
    Object.keys(D.edges).forEach(function (id) {
      var e = D.edges[id], k = 'e:' + id;
      var pass = S.dirs[e.d] && RANK[e.c] >= S.minc, hit = !M || M.keys.has(k), on = pass && hit && lensOK(k);
      if (on) { shown++; bright.add('n:' + e.s); if (e.t) bright.add('n:' + e.t); if (e.te) { bright.add('n:' + D.edges[e.te].s); } }
      dim(P, k, !on);
      if (P.itemRows[id]) P.itemRows[id].hidden = !(pass && hit);
    });
    Object.keys(D.gaps).forEach(function (id) {
      var g = D.gaps[id], k = 'g:' + id, hit = !M || M.keys.has(k), on = S.gaps && hit && lensOK(k);
      if (on) { bright.add('n:' + g.s); bright.add('n:' + g.t); }
      dim(P, k, !on);
      if (P.gapRows[id]) P.gapRows[id].hidden = !(S.gaps && hit);
    });
    var all = !M && S.lens === 'all' && shown === D.total;
    Object.keys(D.nodes).forEach(function (id) {
      var k = 'n:' + id; dim(P, k, !(all || bright.has(k) || (M && M.keys.has(k))));
    });
    P.mem.forEach(function (m) {
      var ids = m.getAttribute('data-mem').split(' ');
      m.classList.toggle('is-dim', !(all || S.lens === 'inter' || (bright.has('n:' + ids[0]) && bright.has('n:' + ids[1]))));
    });
    P.status.textContent = 'Showing ' + shown + ' of ' + D.total + ' ' + D.noun;
    // claims table: each claim's own direction and grade, plus the search
    var vis = 0, cap = P.showAll ? Infinity : PAGE;
    $$('tbody', P.claimTable).forEach(function (tb) {
      var n = 0;
      $$('tr[data-d]', tb).forEach(function (r) {
        var c = r.id.slice(P.pre.length + 1);
        var ok = S.dirs[r.getAttribute('data-d')] !== false && RANK[r.getAttribute('data-g')] >= S.minc &&
          (!M || M.claims.has(c) || M.pdocs.has(P.claimDoc[c]));
        if (ok) vis++;
        r.hidden = !(ok && vis <= cap);
        if (!r.hidden) n++;
      });
      tb.hidden = n === 0;
    });
    if (P.more) {
      P.more.hidden = vis <= PAGE;
      P.more.textContent = P.showAll ? 'Show the first ' + PAGE + ' claims' : 'Show all ' + vis + ' claims';
    }
    P.paperRows.forEach(function (r) { r.hidden = !!M && !M.docs.has(r.getAttribute('data-doc')); });
    P.intRows.forEach(function (r) {
      r.hidden = S.dirs[r.getAttribute('data-direction')] === false || (!!M && !M.claims.has(r.getAttribute('data-interaction-id')));
    });
  }

  /* ---------------------------------------------------------------- wiring */
  function sortable(P) {
    $$('table.sortable', P.sec).forEach(function (tbl) {
      var tb = tbl.tBodies[0], orig = $$('tr', tb);
      function val(r, s) {
        if (s === 'dir') return DIRS.indexOf(r.getAttribute('data-direction'));
        if (s === 'cert') return RANK[r.getAttribute('data-certainty')];
        if (s === 'studies' || s === 'claims') return +r.getAttribute('data-' + s);
        return low(r.cells[+s].textContent);
      }
      $$('thead button[data-sort]', tbl).forEach(function (b) {
        b.addEventListener('click', function () {
          var th = b.parentNode, dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
          var s = b.getAttribute('data-sort'), sign = dir === 'ascending' ? 1 : -1;
          $$('thead th', tbl).forEach(function (h) { h.removeAttribute('aria-sort'); });
          th.setAttribute('aria-sort', dir);
          orig.slice().sort(function (x, y) {
            var a = val(x, s), c = val(y, s);
            return (a < c ? -1 : a > c ? 1 : 0) * sign || orig.indexOf(x) - orig.indexOf(y);
          }).forEach(function (r) { tb.appendChild(r); });
        });
      });
    });
  }
  function wire(P) {
    var stage = P.stage;
    stage.addEventListener('pointerover', function (ev) {
      var t = ev.target.closest('[data-k]');
      if (!t || ev.pointerType === 'touch') return;
      var k = t.getAttribute('data-k');
      if (k === hcKey) return;
      hcKey = k; clearTimeout(hcTimer);
      if (P.svg.contains(t)) highlight(P, k);
      var x = ev.clientX, y = ev.clientY;
      hcTimer = setTimeout(function () { showCard(P, k, x, y); }, 110);
    });
    stage.addEventListener('pointerout', function (ev) {
      var t = ev.target.closest('[data-k]');
      if (!t) return;
      var to = ev.relatedTarget && ev.relatedTarget.closest ? ev.relatedTarget.closest('[data-k]') : null;
      if (to && to.getAttribute('data-k') === t.getAttribute('data-k')) return;
      hideCard(); clearHL(P);
    });
    stage.addEventListener('focusin', function (ev) {
      var t = ev.target.closest('[data-k]');
      if (!t) return;
      var k = t.getAttribute('data-k');
      hcKey = k; clearTimeout(hcTimer);
      if (P.svg.contains(t)) highlight(P, k);
      hcTimer = setTimeout(function () { showCard(P, k, 0, 0, t.getBoundingClientRect()); }, 60);
    });
    stage.addEventListener('focusout', function () { hideCard(); clearHL(P); });
    stage.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if ((ev.key === 'Enter' || ev.key === ' ') && t.getAttribute('role') === 'button' && t.hasAttribute('data-k')) {
        ev.preventDefault(); pin(P, t.getAttribute('data-k'), { focus: true, opener: t });
      }
    });
    P.sec.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-k]');
      if (t) {
        ev.preventDefault();
        var fromRes = P.res.contains(t);
        if (fromRes) P.res.hidden = true;
        pin(P, t.getAttribute('data-k'), { focus: true, opener: fromRes ? P.q : t });
        return;
      }
      var b = ev.target.closest('button');
      if (!b) return;
      if (b === P.dx) closeDrawer(P);
      else if (b === P.more) { P.showAll = !P.showAll; apply(P); }
      else if (b.hasAttribute('data-lens')) {
        P.st.lens = b.getAttribute('data-lens');
        $$('[data-lens]', P.sec).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        apply(P);
      } else if (b.hasAttribute('data-dir')) {
        var d = b.getAttribute('data-dir');
        P.st.dirs[d] = !P.st.dirs[d];
        b.setAttribute('aria-pressed', String(P.st.dirs[d]));
        apply(P);
      } else if (b.hasAttribute('data-view')) {
        var v = b.getAttribute('data-view');
        $$('.views [data-view]', P.sec).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        $$('.view', stage).forEach(function (x) { x.classList.toggle('is-active', x.getAttribute('data-view') === v); });
      }
    });
    P.sec.querySelector('[data-minc]').addEventListener('change', function (ev) { P.st.minc = +ev.target.value; apply(P); });
    P.sec.querySelector('[data-gaps]').addEventListener('change', function (ev) { P.st.gaps = ev.target.checked; apply(P); });
    var qt = 0;
    P.q.addEventListener('input', function () { clearTimeout(qt); qt = setTimeout(function () { search(P); }, 120); });
    P.q.addEventListener('focus', function () { if (P.q.value.trim()) P.res.hidden = false; });
    doc.addEventListener('click', function (ev) { if (!ev.target.closest('.search')) P.res.hidden = true; });
    sortable(P);
  }

  /* ---------------------------------------------------------------- tabs + hash routing */
  function select(key, focus) {
    current = key;
    tabList.forEach(function (a) {
      var on = a.getAttribute('data-tab') === key;
      a.setAttribute('aria-selected', String(on));
      a.tabIndex = on ? 0 : -1;
      doc.getElementById(a.getAttribute('data-tab')).hidden = !on;
      if (on && focus) a.focus();
    });
  }
  function tabs() {
    var list = doc.querySelector('.cards');
    tabList = $$('[data-tab]', list);
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Panels');
    tabList.forEach(function (a, i) {
      var key = a.getAttribute('data-tab'), p = doc.getElementById(key);
      a.setAttribute('role', 'tab'); a.setAttribute('aria-controls', key);
      p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', a.id);
      a.addEventListener('click', function (ev) { ev.preventDefault(); select(key); history.replaceState(null, '', '#' + key); });
      a.addEventListener('keydown', function (ev) {
        var j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabList.length - 1 }[ev.key];
        if (j == null) return;
        ev.preventDefault();
        var n = tabList[(j + tabList.length) % tabList.length].getAttribute('data-tab');
        select(n, true); history.replaceState(null, '', '#' + n);
      });
    });
  }
  function route(first) {
    var h = location.hash.slice(1);
    try { h = decodeURIComponent(h); } catch (e) { /* keep raw */ }
    var parts = h.split('/'), P = panels[parts[0]];
    if (P) {
      select(P.key);
      // the browser scrolled to the panel before this script hid the other one
      if (first === true) scrollTo(0, 0);
      if (parts.length > 2 && KEY[parts[1]]) pin(P, KEY[parts[1]] + ':' + parts.slice(2).join('/'), { nohash: true });
      return;
    }
    var t = h && doc.getElementById(h);
    if (t && t.closest('.panel')) {
      var sec = t.closest('.panel');
      select(sec.id);
      var det = t.closest('details');
      if (det) det.open = true;
      if (t.closest('.t-claims')) { panels[sec.id].showAll = true; apply(panels[sec.id]); }
      t.scrollIntoView();
      return;
    }
    select(current);
  }

  doc.addEventListener('keydown', function (ev) {
    var P = panels[current];
    if (!P) return;
    var tag = ev.target.tagName;
    if (ev.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag) && !ev.metaKey && !ev.ctrlKey) {
      ev.preventDefault(); P.q.focus(); return;
    }
    if (ev.key !== 'Escape') return;
    if (!hc.hidden) { hideCard(); return; }
    if (ev.target === P.q) {
      if (P.q.value) { P.q.value = ''; search(P); } else P.res.hidden = true;
      return;
    }
    if (!P.res.hidden) { P.res.hidden = true; return; }
    if (P.pinned) closeDrawer(P);
  });

  // long tables are open without JavaScript; with it they start closed
  $$('details.js-close').forEach(function (d) { d.open = false; });
  $$('.panel').forEach(function (s) { var P = setup(s); panels[P.key] = P; apply(P); });
  tabs();
  route(true);
  addEventListener('hashchange', route);
})();
