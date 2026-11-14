/* Q1 prototype, rank 2: theme toggle, tabs, click selection with active
   pathways, drawer, search, lenses, filters, matrix toggle, table sort and
   paging. No framework. Nothing happens on hover. All text it shows comes
   from the page, the JSON island, or data/<panel>.json (this site's own file,
   fetched once when the reader first needs claims or a drawer). */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var DIRS = ['increase', 'decrease', 'mixed', 'no_effect', 'unclear'];
  // fixed 1:1 display maps (SPEC 1.4)
  var DW = { increase: 'Increase', decrease: 'Decrease', mixed: 'Mixed (studies disagree)', no_effect: 'No effect (tested)', unclear: 'Unclear' };
  var DG = { increase: '↑', decrease: '↓', mixed: '↕', no_effect: '=', unclear: '?' };
  var CW = { high: 'High', moderate: 'Moderate', low: 'Low', very_low: 'Very low' };
  var RANK = { very_low: 1, low: 2, moderate: 3, high: 4 };
  var KEY = { node: 'n', edge: 'e', finding: 'e', gap: 'g', paper: 'p', claim: 'c' };
  var PAGE = 25;
  var darkMQ = matchMedia('(prefers-color-scheme: dark)');
  var smooth = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  var panels = {}, current = 'findings', tabList = [];

  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function txt(s) { return doc.createTextNode(s); }
  function low(s) { return String(s || '').toLowerCase(); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ---------------------------------------------------------------- theme (SPEC 4.2)
     The inline <head> script applies a stored choice before the first paint. */
  function theme() { return root.getAttribute('data-theme') || (darkMQ.matches ? 'dark' : 'light'); }
  function themeUI() {
    var d = theme() === 'dark';
    $$('.theme').forEach(function (b) {
      b.setAttribute('aria-pressed', String(d));
      b.setAttribute('aria-label', d ? 'Switch to light theme' : 'Switch to dark theme');
    });
  }
  $$('.theme').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = theme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', t);
      try { localStorage.setItem('q1-theme', t); } catch (e) { /* storage blocked: the choice lasts for this view */ }
      themeUI();
    });
  });
  if (darkMQ.addEventListener) darkMQ.addEventListener('change', themeUI);
  themeUI();
  if (!doc.querySelector('.panel')) return; // claims pages need only the theme

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
  function dirLabel(d) {
    var s = el('span', 'dl d-' + d), g = el('span', 'g', DG[d]);
    g.setAttribute('aria-hidden', 'true');
    s.appendChild(g); s.appendChild(txt(' ' + DW[d]));
    return s;
  }

  /* ---------------------------------------------------------------- setup */
  function setup(sec) {
    var P = { sec: sec, key: sec.id, pre: sec.getAttribute('data-pre') };
    P.data = JSON.parse(doc.getElementById(P.pre + '-data').textContent);
    P.svg = sec.querySelector('svg.graph');
    P.mx = sec.querySelector('table.matrix');
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
    P.host = sec.querySelector('.claims-host');
    P.claimsDet = doc.getElementById(P.pre + '-claims');
    P.claimsPage = 'claims-' + P.key + '.html';
    P.selbar = sec.querySelector('.selbar');
    P.selMsg = P.selbar.querySelector('.sel-msg');
    P.selNote = P.selbar.querySelector('.sel-note');
    P.selClear = P.selbar.querySelector('.sel-clear');
    P.selGo = P.selbar.querySelector('.sel-go');
    P.hint = P.selMsg.textContent;
    P.st = { dirs: {}, minc: 0, gaps: true, lens: 'all' };
    DIRS.forEach(function (d) { P.st.dirs[d] = true; });
    P.match = null; P.sel = null; P.tok = 0; P.showAll = false; P.claims = {};
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
    P.paperRows = $$('.t-papers tbody tr', sec);
    P.intRows = $$('.t-int tbody tr', sec);
    P.lens = {};
    if (P.data.lens) Object.keys(P.data.lens).forEach(function (k) { P.lens[k] = new Set(P.data.lens[k]); });
    // adjacency of effect edges (a moderation edge has no target node)
    P.out = {}; P.inn = {}; P.nodeGaps = {};
    Object.keys(P.data.edges).forEach(function (id) {
      var e = P.data.edges[id];
      e.cl = [];
      if (!e.t) return;
      (P.out[e.s] = P.out[e.s] || []).push(id);
      (P.inn[e.t] = P.inn[e.t] || []).push(id);
    });
    Object.keys(P.data.gaps).forEach(function (id) {
      var g = P.data.gaps[id];
      [g.s, g.t].forEach(function (n) { (P.nodeGaps[n] = P.nodeGaps[n] || []).push(id); });
    });
    wire(P);
    return P;
  }

  /* ---------------------------------------------------------------- data/<panel>.json, loaded once */
  function load(P) {
    if (P.J) return Promise.resolve(P);
    if (!P.loading) {
      P.loading = fetch('data/' + P.key + '.json').then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (J) { ingest(P, J); return P; });
      P.loading.catch(function () { P.loading = null; });
    }
    return P.loading;
  }
  // claim arrays: [subject, predicate, object, negated, direction, grade, evidence types, comparator, quote, document_id]
  function ingest(P, J) {
    P.J = J; P.ev = J.claims; P.papers = J.papers; P.cards = J.cards;
    P.claimDoc = {}; P.claimText = {}; P.claimGroup = {};
    Object.keys(P.ev).forEach(function (c) {
      var e = P.ev[c];
      P.claimDoc[c] = e[9];
      P.claimText[c] = low([e[0], e[1], e[2], e[6], e[7], e[8], e[9]].join(' '));
    });
    J.groups.forEach(function (g) {
      g[3].forEach(function (c) { P.claimGroup[c] = g[1]; });
      var id = g[1] && g[1].slice(2);
      if (id && P.data.edges[id]) P.data.edges[id].cl = g[3];
    });
    buildClaims(P);
    apply(P);
  }
  function failNote(P, what) {
    var p = el('p', 'drawer-empty', what + ' could not be loaded. All claims and quotes are also on ');
    var a = el('a', null, 'the claims page'); a.href = P.claimsPage;
    p.appendChild(a); p.appendChild(txt('.'));
    return p;
  }

  /* ---------------------------------------------------------------- claims (table rows and drawer cards) */
  function claimLine(e) {
    var f = doc.createDocumentFragment();
    f.appendChild(el('b', null, e[0])); f.appendChild(txt(' → '));
    f.appendChild(el('i', null, e[1]));
    if (e[3]) { f.appendChild(txt(' ')); f.appendChild(el('span', 'neg', 'negated')); }
    f.appendChild(txt(' → ')); f.appendChild(el('b', null, e[2]));
    return f;
  }
  function claimRow(P, c) {
    var e = P.ev[c], pm = P.papers[e[9]] || ['', null, null], r = el('tr'), td;
    r.id = P.pre + '-' + c;
    r.setAttribute('data-c', c); r.setAttribute('data-d', e[4]); r.setAttribute('data-g', e[5]);
    td = el('td'); td.appendChild(claimLine(e)); td.appendChild(el('small', null, e[6] + ' · ' + e[7])); r.appendChild(td);
    td = el('td'); td.appendChild(dirLabel(e[4])); r.appendChild(td);
    r.appendChild(el('td', null, CW[e[5]]));
    td = el('td'); td.appendChild(el('q', null, e[8])); r.appendChild(td);
    td = el('td'); td.appendChild(docLink(e[9], pm[2])); td.appendChild(txt(' ')); td.appendChild(el('small', null, pm[1] ? String(pm[1]) : '–'));
    r.appendChild(td);
    return r;
  }
  function buildClaims(P) {
    var t = el('table', 't-claims'), hr = el('tr'), thead = el('thead');
    t.appendChild(el('caption', null, 'All ' + Object.keys(P.ev).length + ' claims with their source sentences'));
    ['Claim', 'Direction', 'Grade', 'Quote', 'Paper'].forEach(function (h) { var x = el('th', null, h); x.scope = 'col'; hr.appendChild(x); });
    thead.appendChild(hr); t.appendChild(thead);
    P.J.groups.forEach(function (g) {
      var tb = el('tbody'), gr = el('tr', 'grp'), th = el('th', null, g[2] + ' · ' + plural(g[3].length, 'claim', 'claims'));
      tb.id = g[0];
      th.colSpan = 5; th.scope = 'rowgroup';
      gr.appendChild(th); tb.appendChild(gr);
      g[3].forEach(function (c) { var r = claimRow(P, c); P.claims[c] = r; tb.appendChild(r); });
      t.appendChild(tb);
    });
    var w = el('div', 'tscroll');
    w.appendChild(t);
    P.host.textContent = '';
    P.host.appendChild(w);
    P.claimTable = t;
  }
  function claimCard(P, c) {
    var e = P.ev[c], art = el('article', 'claim'), p1 = el('p', 'ctext'), p2 = el('p', 'cmeta');
    art.setAttribute('data-cid', c);
    p1.appendChild(claimLine(e)); art.appendChild(p1);
    p2.appendChild(dirLabel(e[4]));
    p2.appendChild(txt(' · Grade: ' + CW[e[5]] + ' · ' + e[6] + ' · ' + e[7] + ' · '));
    p2.appendChild(el('span', 'mono', c));
    art.appendChild(p2);
    art.appendChild(el('blockquote', null, e[8]));
    return art;
  }
  function paperHead(P, d, n) {
    var pm = P.papers[d], sec = el('section', 'paper'), meta = el('p', 'pmeta');
    sec.appendChild(el('h4', null, pm[0]));
    meta.appendChild(txt((pm[1] || '–') + ' · '));
    meta.appendChild(docLink(d, pm[2]));
    if (n) meta.appendChild(txt(' · ' + plural(n, 'claim', 'claims')));
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
    frag.appendChild(el('p', 'lbl', 'Claims by paper (' + plural(order.length, 'paper', 'papers') + ')'));
    order.forEach(function (d) {
      var sec = paperHead(P, d, by[d].length);
      by[d].forEach(function (c) { sec.appendChild(claimCard(P, c)); });
      frag.appendChild(sec);
    });
    return frag;
  }
  function paperView(P, d) {
    var pm = P.papers[d], frag = doc.createDocumentFragment(), card = el('div', 'card'), meta = el('p', 'card-n'), done = {};
    card.appendChild(el('p', 'card-k', 'Paper'));
    card.appendChild(el('p', 'card-t', pm[0]));
    meta.appendChild(txt((pm[1] || '–') + ' · '));
    meta.appendChild(docLink(d, pm[2]));
    card.appendChild(meta);
    frag.appendChild(card);
    Object.keys(P.data.edges).forEach(function (id) {
      var cl = P.data.edges[id].cl.filter(function (c) { return P.claimDoc[c] === d; });
      if (!cl.length) return;
      var sec = el('section', 'paper'), h = el('h4'), b = el('button', 'mini', edgeLabel(P, id));
      b.type = 'button'; b.setAttribute('data-k', 'e:' + id);
      h.appendChild(b); sec.appendChild(h);
      cl.forEach(function (c) { done[c] = 1; sec.appendChild(claimCard(P, c)); });
      frag.appendChild(sec);
    });
    var rest = Object.keys(P.ev).filter(function (c) { return P.claimDoc[c] === d && !done[c]; });
    if (rest.length) {
      var sec = el('section', 'paper');
      sec.appendChild(el('h4', null, 'Interaction claims (listed, not pooled)'));
      rest.forEach(function (c) { sec.appendChild(claimCard(P, c)); });
      frag.appendChild(sec);
    }
    return frag;
  }

  /* ---------------------------------------------------------------- active pathways (SPEC 3.6)
     Edges on any directed path through N: everything downstream of N and
     everything upstream into N. "near" edges touch N; "far" edges do not.
     Nothing is added or multiplied along a path. */
  function pathways(P, id) {
    var D = P.data, near = [], far = [], seen = {}, nodes = {}, mem = [];
    nodes[id] = 1;
    function add(eid) {
      if (seen[eid]) return;
      seen[eid] = 1;
      var e = D.edges[eid];
      (e.s === id || e.t === id ? near : far).push(eid);
    }
    function walk(adj, end) {
      var done = {}, q = [id];
      done[id] = 1;
      while (q.length) {
        (adj[q.shift()] || []).forEach(function (eid) {
          add(eid);
          var m = D.edges[eid][end];
          nodes[m] = 1;
          if (!done[m]) { done[m] = 1; q.push(m); }
        });
      }
    }
    walk(P.out, 't');
    walk(P.inn, 's');
    // a moderation edge whose source is N (then also its target edge), or that changes an active edge
    Object.keys(D.edges).forEach(function (mid) {
      var m = D.edges[mid];
      if (!m.te) return;
      if (m.s === id) {
        seen[mid] = 1; near.push(mid);
        var te = D.edges[m.te];
        add(m.te); nodes[te.s] = 1; nodes[te.t] = 1;
      } else if (seen[m.te]) {
        seen[mid] = 1; (near.indexOf(m.te) >= 0 ? near : far).push(mid); nodes[m.s] = 1;
      }
    });
    var gaps = P.nodeGaps[id] || [];
    gaps.forEach(function (gid) { var g = D.gaps[gid]; nodes[g.s] = 1; nodes[g.t] = 1; });
    // combination: N's combination node when N is a member, the members when N is the combination
    P.mem.forEach(function (m) {
      var ids = m.getAttribute('data-mem').split(' ');
      if (ids.indexOf(id) >= 0) { mem.push(m); nodes[ids[0]] = 1; nodes[ids[1]] = 1; }
    });
    return { near: near, far: far, gaps: gaps, nodes: Object.keys(nodes), mem: mem };
  }
  function addCls(P, k, c) { (P.marks[k] || []).forEach(function (n) { n.classList.add(c); }); }
  function unmark(P) {
    [P.svg, P.mx].forEach(function (x) { if (x) x.classList.remove('sel-on'); });
    $$('.is-on, .is-far, .is-sel', P.stage).forEach(function (n) { n.classList.remove('is-on', 'is-far', 'is-sel'); });
    status(P, null, false);
  }
  function mark(P, k) {
    unmark(P);
    var t = k[0], id = k.slice(2), D = P.data, on = [k], far = [], msg, note = false;
    if (t === 'n') {
      var w = pathways(P, id), n = D.nodes[id], noun = D.noun === 'edges' ? ['edge', 'edges'] : ['finding', 'findings'];
      w.near.concat(w.far).forEach(function (e) { on.push('e:' + e); });
      w.far.forEach(function (e) { far.push('e:' + e); });
      w.gaps.forEach(function (g) { on.push('g:' + g); });
      w.nodes.forEach(function (x) { on.push('n:' + x); });
      w.mem.forEach(function (m) { m.classList.add('is-on'); });
      msg = 'Pathways through ' + n.l + ': ' + plural(w.near.length + w.far.length, noun[0], noun[1]) +
        ' (' + w.near.length + ' direct, ' + w.far.length + ' further)';
      if (w.gaps.length) msg += ' · ' + plural(w.gaps.length, 'gap', 'gaps') + ' (no evidence)';
      note = w.far.length > 0 || n.k === 'condition';
    } else if (t === 'e') {
      var e = D.edges[id];
      on.push('n:' + e.s);
      if (e.t) on.push('n:' + e.t);
      if (e.te) { var te = D.edges[e.te]; on.push('e:' + e.te, 'n:' + te.s, 'n:' + te.t); }
      msg = (e.te ? 'Moderation edge: ' : D.noun === 'edges' ? 'Edge: ' : 'Finding: ') + edgeLabel(P, id) +
        ' · ' + DW[e.d] + ' · certainty ' + CW[e.c];
    } else if (t === 'g') {
      var g = D.gaps[id];
      on.push('n:' + g.s, 'n:' + g.t);
      msg = 'Gap: ' + lab(P, g.s) + ' → ' + lab(P, g.t) + ' · No evidence. No study in this corpus tested this pairing.';
    } else {
      status(P, 'A paper is open in the details panel.', false);
      return;
    }
    [P.svg, P.mx].forEach(function (x) { if (x) x.classList.add('sel-on'); });
    on.forEach(function (x) { addCls(P, x, 'is-on'); });
    far.forEach(function (x) { addCls(P, x, 'is-far'); });
    addCls(P, k, 'is-sel');
    status(P, msg, note);
  }
  function status(P, msg, note) {
    P.selbar.classList.toggle('is-on', !!msg);
    P.selMsg.textContent = msg || P.hint;
    P.selNote.hidden = !note;
    P.selClear.hidden = !msg;
    P.selGo.hidden = !msg;
  }

  /* ---------------------------------------------------------------- selection + drawer (L3-L5) */
  function exists(P, t, id) {
    var D = P.data;
    return t === 'n' ? !!D.nodes[id] : t === 'e' ? !!D.edges[id] : t === 'g' ? !!D.gaps[id] : t === 'p';
  }
  // #network, #network/node/<id>, #findings/finding/<id>, …/gap/<id>, …/paper/<doi>
  function hashFor(P) {
    if (!P.sel) return '#' + P.key;
    var t = P.sel.k[0], type = t === 'e' ? (P.key === 'network' ? 'edge' : 'finding') : { n: 'node', g: 'gap', p: 'paper' }[t];
    return '#' + P.key + '/' + type + '/' + P.sel.k.slice(2);
  }
  function unpinRows(P) { $$('tr.is-pin', P.sec).forEach(function (n) { n.classList.remove('is-pin'); }); }
  function reveal(P, row) {
    if (!row) return;
    P.claimsDet.open = true;
    if (row.hidden) { P.showAll = true; apply(P); }
    unpinRows(P);
    row.classList.add('is-pin');
    row.scrollIntoView({ block: 'center', behavior: smooth });
  }
  function render(P, k) {
    var t = k[0], id = k.slice(2);
    P.dbody.textContent = '';
    if (t === 'p') { P.dbody.appendChild(paperView(P, id)); return; }
    var tp = el('template');
    tp.innerHTML = P.cards[k] || ''; // our own build-time HTML (autoescaped by Jinja)
    P.dbody.appendChild(tp.content);
    if (t === 'e') P.dbody.appendChild(claimsByPaper(P, P.data.edges[id].cl));
  }
  // o: toggle (a second click on the same graph item clears), opener, focus, reveal, nohash, cid
  function select(P, k, o) {
    o = o || {};
    var t = k[0], id = k.slice(2);
    if (t === 'c') {
      load(P).then(function () {
        if (!P.ev[id]) return;
        var g = P.claimGroup[id];
        if (g) select(P, g, { opener: o.opener, focus: o.focus, reveal: o.reveal, cid: id });
        else reveal(P, P.claims[id]);
      }, function () {});
      return;
    }
    if (!exists(P, t, id)) return;
    if (o.toggle && P.sel && P.sel.k === k) { clear(P, false); return; }
    P.sel = { k: k, opener: o.opener || null };
    mark(P, k);
    unpinRows(P);
    var row = t === 'e' ? P.itemRows[id] : t === 'g' ? P.gapRows[id] : null;
    if (row) row.classList.add('is-pin');
    if (!o.nohash) history.replaceState(null, '', hashFor(P));
    P.dx.hidden = false;
    P.drawer.classList.add('is-open');
    var tok = ++P.tok;
    if (!P.J) { P.dbody.textContent = ''; P.dbody.appendChild(el('p', 'drawer-empty', 'Loading…')); }
    load(P).then(function () {
      if (tok !== P.tok) return;
      if (t === 'p' && !P.papers[id]) { clear(P, false); return; }
      render(P, k);
      P.drawer.scrollTop = 0;
      var r = P.drawer.getBoundingClientRect();
      if (o.reveal && (r.top < 0 || r.top > innerHeight - 80)) P.drawer.scrollIntoView({ block: 'start', behavior: smooth });
      if (o.cid) {
        var card = P.dbody.querySelector('[data-cid="' + o.cid + '"]');
        if (card) { card.classList.add('is-target'); card.scrollIntoView({ block: 'nearest' }); }
      }
      if (o.focus) P.dh.focus({ preventScroll: true });
    }, function () {
      if (tok !== P.tok) return;
      P.dbody.textContent = '';
      P.dbody.appendChild(failNote(P, 'The details'));
    });
  }
  function clear(P, restore) {
    var op = P.sel && P.sel.opener;
    P.sel = null; P.tok++;
    unmark(P);
    unpinRows(P);
    P.dbody.innerHTML = P.empty;
    P.dx.hidden = true;
    P.drawer.classList.remove('is-open');
    history.replaceState(null, '', '#' + P.key);
    if (!restore) return;
    if (op && doc.contains(op) && op.getClientRects().length) op.focus({ preventScroll: true });
    else P.q.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------- search */
  function search(P) {
    if (!P.q.value.trim()) { P.match = null; P.res.hidden = true; P.res.textContent = ''; apply(P); return; }
    load(P).then(function () { runSearch(P); }, function () { runSearch(P); });
  }
  function runSearch(P) {
    var q = low(P.q.value.trim()), D = P.data, papers = P.papers || {}, texts = P.claimText || {};
    if (!q) return;
    // keys: graph items; claims: claim ids; pdocs: papers whose title matched; docs: pdocs + papers of matched claims
    var M = { keys: new Set(), claims: new Set(), pdocs: new Set(), docs: new Set() };
    var nodes = [], edges = [], plist = [], claims = [];
    Object.keys(D.nodes).forEach(function (id) {
      if (low(D.nodes[id].l).indexOf(q) >= 0) { nodes.push(['n:' + id, D.nodes[id].l]); M.keys.add('n:' + id); }
    });
    Object.keys(papers).forEach(function (d) {
      if (low(papers[d][0]).indexOf(q) >= 0 || low(d).indexOf(q) >= 0) { plist.push(['p:' + d, papers[d][0]]); M.pdocs.add(d); M.docs.add(d); }
    });
    Object.keys(texts).forEach(function (c) {
      if (texts[c].indexOf(q) >= 0) {
        claims.push(['c:' + c, P.ev[c][0] + ' → ' + P.ev[c][2]]);
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
    [['Nodes', nodes], [D.noun === 'edges' ? 'Edges' : 'Findings', edges], ['Papers', plist], ['Claims', claims]].forEach(function (g) {
      var sec = el('section');
      sec.appendChild(el('h4', null, g[0] + ' (' + g[1].length + ')'));
      if (g[1].length) {
        any = true;
        var ul = el('ul');
        g[1].slice(0, 6).forEach(function (x) {
          var li = el('li'), b = el('button', null, x[1]);
          b.type = 'button'; b.setAttribute('data-k', x[0]);
          li.appendChild(b); ul.appendChild(li);
        });
        sec.appendChild(ul);
        if (g[1].length > 6) sec.appendChild(el('p', 'more-n', '+' + (g[1].length - 6) + ' more'));
      }
      R.appendChild(sec);
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
      if (on) { shown++; bright.add('n:' + e.s); if (e.t) bright.add('n:' + e.t); if (e.te) bright.add('n:' + D.edges[e.te].s); }
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
    // claims table (once loaded): each claim's own direction and grade, plus the search
    if (P.claimTable) {
      var vis = 0, cap = P.showAll ? Infinity : PAGE;
      $$('tbody', P.claimTable).forEach(function (tb) {
        var n = 0;
        $$('tr[data-d]', tb).forEach(function (r) {
          var c = r.getAttribute('data-c');
          var ok = S.dirs[r.getAttribute('data-d')] !== false && RANK[r.getAttribute('data-g')] >= S.minc &&
            (!M || M.claims.has(c) || M.pdocs.has(P.claimDoc[c]));
          if (ok) vis++;
          r.hidden = !(ok && vis <= cap);
          if (!r.hidden) n++;
        });
        tb.hidden = n === 0;
      });
      P.more.hidden = vis <= PAGE;
      P.more.textContent = P.showAll ? 'Show the first ' + PAGE + ' claims' : 'Show all ' + vis + ' claims';
    }
    P.paperRows.forEach(function (r) { r.hidden = !!M && !M.docs.has(r.getAttribute('data-doc')); });
    P.intRows.forEach(function (r) {
      r.hidden = S.dirs[r.getAttribute('data-direction')] === false || (!!M && !M.claims.has(r.getAttribute('data-interaction-id')));
    });
  }

  /* ---------------------------------------------------------------- wiring (click and keys only; no hover handlers) */
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
    // Enter / Space on a focused SVG node, chip or gap label selects it
    P.stage.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if ((ev.key === 'Enter' || ev.key === ' ') && t.getAttribute('role') === 'button' && t.hasAttribute('data-k')) {
        ev.preventDefault();
        select(P, t.getAttribute('data-k'), { toggle: true, focus: true, opener: t });
      }
    });
    P.sec.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-k]');
      if (t) {
        ev.preventDefault();
        var inStage = P.stage.contains(t), fromRes = P.res.contains(t);
        if (fromRes) P.res.hidden = true;
        select(P, t.getAttribute('data-k'), { toggle: inStage, opener: fromRes ? P.q : t, reveal: !inStage, focus: !inStage });
        return;
      }
      if (P.sel && ev.target.closest('svg.graph')) { clear(P, false); return; } // empty canvas
      var b = ev.target.closest('button');
      if (!b) return;
      if (b === P.dx || b === P.selClear) clear(P, true);
      else if (b === P.selGo) P.drawer.scrollIntoView({ block: 'start', behavior: smooth });
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
        $$('.view', P.stage).forEach(function (x) { x.classList.toggle('is-active', x.getAttribute('data-view') === v); });
      }
    });
    P.sec.querySelector('[data-minc]').addEventListener('change', function (ev) { P.st.minc = +ev.target.value; apply(P); });
    P.sec.querySelector('[data-gaps]').addEventListener('change', function (ev) { P.st.gaps = ev.target.checked; apply(P); });
    var qt = 0;
    P.q.addEventListener('input', function () { clearTimeout(qt); qt = setTimeout(function () { search(P); }, 120); });
    P.q.addEventListener('focus', function () { if (P.q.value.trim() && P.res.childNodes.length) P.res.hidden = false; });
    // the claims table is built from data/<panel>.json the first time it opens
    P.claimsDet.addEventListener('toggle', function () {
      if (!P.claimsDet.open || P.J) return;
      P.host.textContent = '';
      P.host.appendChild(el('p', 'fine', 'Loading…'));
      load(P).catch(function () { P.host.textContent = ''; P.host.appendChild(failNote(P, 'The claims')); });
    });
    sortable(P);
  }

  /* ---------------------------------------------------------------- tabs + hash routing */
  function selectTab(key, focus) {
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
      a.addEventListener('click', function (ev) { ev.preventDefault(); selectTab(key); history.replaceState(null, '', hashFor(panels[key])); });
      a.addEventListener('keydown', function (ev) {
        var j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabList.length - 1 }[ev.key];
        if (j == null) return;
        ev.preventDefault();
        var n = tabList[(j + tabList.length) % tabList.length].getAttribute('data-tab');
        selectTab(n, true); history.replaceState(null, '', hashFor(panels[n]));
      });
    });
  }
  function route(first) {
    var h = location.hash.slice(1);
    try { h = decodeURIComponent(h); } catch (e) { /* keep raw */ }
    var parts = h.split('/'), P = panels[parts[0]];
    if (P) {
      selectTab(P.key);
      var deep = parts.length > 2 && KEY[parts[1]];
      if (deep) select(P, KEY[parts[1]] + ':' + parts.slice(2).join('/'), { nohash: true });
      else if (P.sel) clear(P, false);
      // a linked selection shows the graph; a plain panel link shows the page top
      // (on first load the browser also scrolls to the fragment, so place again after load)
      var place = function () {
        if (deep && P.sel) P.stage.scrollIntoView({ block: 'start' });
        else if (first === true) scrollTo(0, 0);
      };
      place();
      if (first === true && doc.readyState !== 'complete') addEventListener('load', function () { setTimeout(place, 0); }, { once: true });
      return;
    }
    var t = h && doc.getElementById(h);
    if (t && t.closest('.panel')) {
      var sec = t.closest('.panel');
      selectTab(sec.id);
      var det = t.closest('details');
      if (det) det.open = true;
      t.scrollIntoView();
      return;
    }
    selectTab(current);
  }

  doc.addEventListener('keydown', function (ev) {
    var P = panels[current];
    if (!P) return;
    var tag = ev.target.tagName;
    if (ev.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag) && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
      ev.preventDefault(); P.q.focus(); return;
    }
    if (ev.key !== 'Escape') return;
    if (ev.target === P.q) {
      if (P.q.value) { P.q.value = ''; search(P); } else P.res.hidden = true;
      return;
    }
    if (P.sel) clear(P, true);
    else if (!P.res.hidden) P.res.hidden = true;
  });

  // long tables are open without JavaScript; with it they start closed
  $$('details.js-close').forEach(function (d) { d.open = false; });
  $$('.panel').forEach(function (s) { var P = setup(s); panels[P.key] = P; apply(P); });
  tabs();
  route(true);
  addEventListener('hashchange', route);
})();
