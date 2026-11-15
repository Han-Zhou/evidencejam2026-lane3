// Q1 site, client side. Adds tabs, click selection (a node shows its active
// pathways, an edge its claims), the drawer, search, lenses, filters, the
// matrix toggle, table sorting and the theme toggle. Nothing reacts to
// hover: hover only changes the cursor and the hovered mark's own outline
// (CSS). Pooled values are read from the page (table rows and the SVG).
// Claims and quotes come from data/<panel>.json, fetched from this site the
// first time a drawer, the search or the claims table needs them.
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const DIRS = ["increase", "decrease", "mixed", "no_effect", "unclear"];
  const DW = { increase: "Increase", decrease: "Decrease", mixed: "Mixed (studies disagree)", no_effect: "No effect (tested)", unclear: "Unclear" };
  const CN = { high: 4, moderate: 3, low: 2, very_low: 1 };
  const CW = { high: "High", moderate: "Moderate", low: "Low", very_low: "Very low" };
  const TYPES = { e: "edge", f: "finding", n: "node", g: "gap", p: "paper", c: "claim" };
  const PAGE = 25;
  const HONEST = "Edges beyond the first step are separate bodies of evidence. A path is not one tested effect.";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  // Same rule as the build: escape, then let only a few inline tags through.
  const RICH = /&lt;(\/?)(i|b|em|strong|sub|sup)&gt;|&lt;br\s*\/?&gt;/g;
  const rich = (s) => esc(s).replace(RICH, (m, sl, tag) => (tag ? `<${sl}${tag}>` : "<br>"));
  const dirH = (d) => `<span class="dw d-${esc(d)}">${DW[d] || esc(d)}</span>`;
  const certH = (c) => `<span class="cw c${CN[c] || 0}">${CW[c] || esc(c)}</span>`;
  const btn = (pin, html, cls = "lnk") => `<button type="button" class="${cls}" data-pin="${esc(pin)}">${html}</button>`;
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const yearH = (y) => (y ? esc(y) : "no year");
  const doiH = (pp) => (pp.doi ? `<a href="https://doi.org/${esc(pp.doi)}">doi:${esc(pp.doi)}</a>` : `<span class="mono">${esc(pp.doc)}</span> (no DOI)`);
  const soH = (c) => `${esc(c.s)} <i>${c.n ? "not " : ""}${esc(c.p)}</i> ${esc(c.o)}`;
  const root = document.documentElement;
  const narrow = () => innerWidth <= 960;
  const smooth = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  const P = {};

  // ------------------------------------------------------------ theme
  (function theme() {
    const b = $("#theme");
    if (!b) return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const cur = () => root.dataset.theme || (mq.matches ? "dark" : "light");
    const sync = () => {
      const dark = cur() === "dark";
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    };
    b.addEventListener("click", () => {
      const t = cur() === "dark" ? "light" : "dark";
      root.dataset.theme = t;
      try { localStorage.setItem("q1-theme", t); } catch (e) { /* storage blocked: the choice lasts for this page view */ }
      sync();
    });
    if (mq.addEventListener) mq.addEventListener("change", sync);
    sync();
  })();

  // ------------------------------------------------------------ panel data
  function setup(sec) {
    const k = sec.dataset.panel;
    const p = { k, sec, id: sec.id, svg: $(`#${k}-svg`), dr: $(`#${k}-dr`), st: $(`#${k}-st`), work: $(".work", sec), q: $(`#${k}-q`), sr: $(`#${k}-sr`), cbox: $(".cbox", sec), it: k === "a" ? "f" : "e", lens: "all", dirs: new Set(DIRS), minC: 0, gaps: true, match: null, pinned: null, sel: null, data: null, loading: null, failed: false, claimRows: [] };
    p.rows = new Map($$("tr[data-finding-id],tr[data-edge-id]", sec).map((tr) => [tr.dataset.findingId || tr.dataset.edgeId, tr]));
    p.gapRows = new Map($$("tr[data-gap-id]", sec).map((tr) => [tr.dataset.gapId, tr]));
    p.nodes = new Map($$(".node", p.svg).map((g) => [g.dataset.pin.slice(2), g]));
    p.byPin = new Map();
    for (const el of $$("[data-pin]", p.svg).concat($$(".mx [data-pin]", sec))) {
      if (!p.byPin.has(el.dataset.pin)) p.byPin.set(el.dataset.pin, []);
      p.byPin.get(el.dataset.pin).push(el);
    }
    p.note = $(".note", sec);
    p.hint = p.st.innerHTML;
    p.drHint = p.dr.innerHTML;
    return p;
  }
  const label = (p, id) => (p.nodes.get(id) ? p.nodes.get(id).dataset.label : id);
  const isEdgeTarget = (p, t) => !p.nodes.has(t) && p.rows.has(t);
  function title(p, id) {
    const d = p.rows.get(id).dataset;
    return isEdgeTarget(p, d.t) ? `${label(p, d.s)} changes the effect: ${title(p, d.t)}` : `${label(p, d.s)} → ${label(p, d.t)}`;
  }
  const gapTitle = (p, gid) => { const d = p.gapRows.get(gid).dataset; return `${label(p, d.s)} → ${label(p, d.t)} (no evidence)`; };
  const anchor = (p, id) => `${p.k === "a" ? "f" : "e"}-${p.rows.get(id).id.split("-").pop()}`;
  function info(p, id) {
    const tr = p.rows.get(id);
    if (!tr) return null;
    const d = tr.dataset;
    return {
      id, tr, dir: d.direction, cert: d.certainty, studies: +d.studies, claims: +d.claims, s: d.s, t: d.t, ids: d.ids.split(" "),
      rationale: tr.cells[3].querySelector("small").textContent,
      meaning: (tr.cells[1].querySelector("small") || {}).textContent || "",
      sd: $$(".s", tr.cells[6]).map((s) => [s.classList[1].slice(2), +s.textContent.trim().split(" ").pop()]),
    };
  }
  function paperRow(p, doc) {
    const tr = $$(".pt tbody tr", p.sec).find((r) => r.dataset.doc === doc);
    return tr && { tr, title: tr.cells[0].querySelector("button").innerHTML, year: tr.cells[1].textContent, doi: tr.cells[2].innerHTML };
  }
  const citers = (p, doc) => { const r = paperRow(p, doc); return r ? $$("a.cite", r.tr.cells[4]).map((a) => pinOf($(a.getAttribute("href")))).filter(Boolean) : []; };
  const pooledIn = (p, cid) => [...p.rows.keys()].filter((e) => p.rows.get(e).dataset.ids.split(" ").includes(cid));
  function nodeEdges(p, id) {
    const out = [], inn = [];
    p.rows.forEach((tr, eid) => {
      if (tr.dataset.s === id) out.push(eid);
      else if (tr.dataset.t === id) inn.push(eid);
    });
    return { out, inn };
  }
  const modsOn = (p, eid) => [...p.rows.keys()].filter((m) => p.rows.get(m).dataset.t === eid);

  // ------------------------------------------------------------ claims data (on demand)
  function load(p) {
    if (!p.loading) {
      p.loading = fetch(`data/${p.id}.json`)
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((d) => { p.data = d; p.failed = false; return d; })
        .catch((err) => { p.loading = null; p.failed = true; throw err; });
    }
    return p.loading;
  }
  const claimsPage = (p, a) => `<a href="claims-${p.id}.html${a ? `#${a}` : ""}">claims page</a>`;
  const waitHTML = (p, what, a) => `<p class="wait">${p.failed ? `Could not load the claims here. Read them on the ${claimsPage(p, a)}.` : `Loading ${what}…`}</p>`;
  function byPaper(p, ids) {
    const m = new Map();
    ids.forEach((cid, i) => {
      const c = p.data.claims[cid];
      if (!c) return;
      if (!m.has(c.pp)) m.set(c.pp, { pp: c.pp, first: i, ids: [] });
      m.get(c.pp).ids.push(cid);
    });
    return [...m.values()].sort((a, b) => b.ids.length - a.ids.length || a.first - b.first);
  }
  function claimHTML(p, cid) {
    const c = p.data.claims[cid];
    if (!c) return "";
    return `<li><p class="so">${soH(c)}</p><div class="kv">${dirH(c.d)}<span>grade ${certH(c.g)}</span></div><small>${c.m ? `${esc(c.m)} · ` : ""}<span class="mono">${esc(cid)}</span></small><blockquote>${rich(c.q)}</blockquote></li>`;
  }
  function papersHTML(p, ids) {
    const groups = byPaper(p, ids).map((x) => {
      const pp = p.data.papers[x.pp];
      return `<section><h4>${rich(pp.title)}</h4><p class="muted">${yearH(pp.year)} · ${doiH(pp)} · ${plural(x.ids.length, "claim", "claims")} here</p><ol>${x.ids.map((c) => claimHTML(p, c)).join("")}</ol></section>`;
    });
    return `<h4>Claims by paper (${plural(groups.length, "paper", "papers")})</h4>${groups.join("")}`;
  }

  // ------------------------------------------------------------ html parts
  function sdHTML(sd) {
    const tot = sd.reduce((a, [, n]) => a + n, 0) || 1;
    return `<div class="sdbar" aria-hidden="true">${sd.map(([k, n]) => `<span class="d-${k}" style="flex:${n / tot}"></span>`).join("")}</div><div class="kv">${sd.map(([k, n]) => `<span class="s d-${k}">${DW[k] || esc(k)} ${n}</span>`).join("")}</div>`;
  }
  function edgeHead(p, e) {
    const mod = isEdgeTarget(p, e.t);
    const by = mod ? [] : modsOn(p, e.id);
    return `<div class="kv">${dirH(e.dir)}${certH(e.cert)}<span class="num">${plural(e.studies, "study", "studies")} · ${plural(e.claims, "claim", "claims")}</span></div>` +
      (mod ? `<p class="read">${esc(e.meaning)}</p><p>Target edge: ${btn(`${p.it}:${e.t}`, esc(title(p, e.t)))}</p>` : "") +
      (by.length ? `<p>Its effect is changed by: ${by.map((m) => btn(`${p.it}:${m}`, `${esc(label(p, p.rows.get(m).dataset.s))} (moderation)`)).join("")}</p>` : "") +
      `<p class="read"><b>Certainty rationale:</b> ${esc(e.rationale)}</p><p class="muted">Study directions (number of studies)</p>${sdHTML(e.sd)}`;
  }
  const kindWord = (p, id) => (p.k === "a" ? "Finding" : isEdgeTarget(p, p.rows.get(id).dataset.t) ? "Moderation edge" : "Edge");
  function edgeLine(p, eid, other) {
    const d = p.rows.get(eid).dataset;
    return `<li>${btn(`${p.it}:${eid}`, `<span class="dw d-${d.direction}"></span><span class="cw c${CN[d.certainty]}"></span><span class="vh">${DW[d.direction]}, certainty ${CW[d.certainty]},</span> ${esc(other)}`)}</li>`;
  }

  // ------------------------------------------------------------ active pathways (SPEC 3.6)
  // The effect edges on any directed path through n: everything downstream
  // of n and everything upstream into n. Plus gaps that touch n, moderation
  // edges from n or onto an active edge (with their target edge), and the
  // membership links of a combination. Value: true when the edge is two or
  // more steps from n (it does not touch n). Nothing is added or multiplied.
  function pathways(p, n) {
    const eff = [], mods = [];
    p.rows.forEach((tr, id) => (p.nodes.has(tr.dataset.t) ? eff : mods).push([id, tr.dataset.s, tr.dataset.t]));
    const act = new Map();
    const walk = (down) => {
      const seen = new Set([n]);
      let front = [n];
      while (front.length) {
        const next = [];
        for (const v of front) {
          for (const [id, s, t] of eff) {
            if ((down ? s : t) !== v) continue;
            act.set(id, s !== n && t !== n);
            const w = down ? t : s;
            if (!seen.has(w)) { seen.add(w); next.push(w); }
          }
        }
        front = next;
      }
    };
    walk(true);
    walk(false);
    for (const [id, s, te] of mods) {
      if (s !== n && !act.has(te)) continue;
      act.set(id, s !== n);
      if (!act.has(te)) act.set(te, true);
    }
    const gaps = [...p.gapRows].filter(([, tr]) => tr.dataset.s === n || tr.dataset.t === n).map(([id]) => id);
    const mb = $$(".mb", p.svg).filter((m) => m.dataset.s === n || m.dataset.t === n);
    return { node: n, act, gaps, mb };
  }

  // ------------------------------------------------------------ highlight + status line
  function highlight(p) {
    const pin = p.pinned;
    $$(".on,.far,.sel", p.svg).forEach((el) => el.classList.remove("on", "far", "sel"));
    p.svg.classList.toggle("hl", !!pin);
    p.sel = null;
    if (pin) {
      const t = pin[0], id = pin.slice(2);
      const lit = (key, far) => (p.byPin.get(key) || []).forEach((el) => {
        if (!el.closest("svg")) return;
        el.classList.add("on");
        if (far) el.classList.add("far");
      });
      const edge = (eid, far) => {
        const d = p.rows.get(eid).dataset;
        lit(`${p.it}:${eid}`, far);
        lit(`n:${d.s}`);
        if (p.nodes.has(d.t)) lit(`n:${d.t}`);
        else if (p.rows.has(d.t)) edge(d.t, far); // moderation: its target edge and that edge's ends
      };
      if ((t === "e" || t === "f") && p.rows.has(id)) edge(id);
      else if (t === "g" && p.gapRows.has(id)) {
        const d = p.gapRows.get(id).dataset;
        lit(pin);
        lit(`n:${d.s}`);
        lit(`n:${d.t}`);
      } else if (t === "n" && p.nodes.has(id)) {
        const pw = pathways(p, id);
        pw.act.forEach((far, eid) => {
          const d = p.rows.get(eid).dataset;
          lit(`${p.it}:${eid}`, far);
          lit(`n:${d.s}`);
          if (p.nodes.has(d.t)) lit(`n:${d.t}`);
        });
        pw.gaps.forEach((gid) => { const d = p.gapRows.get(gid).dataset; lit(`g:${gid}`); lit(`n:${d.s}`); lit(`n:${d.t}`); });
        pw.mb.forEach((m) => { m.classList.add("on"); lit(`n:${m.dataset.s}`); lit(`n:${m.dataset.t}`); });
        lit(pin);
        p.nodes.get(id).classList.add("sel");
        p.sel = pw;
      } else if (t === "p") citers(p, id).forEach((x) => edge(x.slice(2)));
      else if (t === "c") pooledIn(p, id).forEach(edge);
    }
    status(p);
  }
  function status(p) {
    const pin = p.pinned;
    p.st.classList.toggle("on", !!pin);
    if (!pin) { p.st.innerHTML = p.hint; return; }
    const t = pin[0], id = pin.slice(2);
    let main = "", note = "";
    if (t === "n" && p.sel) {
      const { act, gaps, mb } = p.sel;
      const far = [...act.values()].filter(Boolean).length;
      const hidden = [...act.keys()].filter((e) => p.rows.get(e).classList.contains("flt")).length;
      const combo = p.nodes.get(id).classList.contains("k-combination");
      main = `${p.k === "a" ? "Findings of" : "Pathways through"} <b>${esc(label(p, id))}</b>: <span class="num">${act.size}</span> ${act.size === 1 ? p.it === "f" ? "finding" : "edge" : p.it === "f" ? "findings" : "edges"}` +
        (far ? ` (<span class="num">${act.size - far}</span> direct, <span class="num">${far}</span> further)` : "") +
        (gaps.length ? ` · <span class="num">${gaps.length}</span> ${gaps.length === 1 ? "gap" : "gaps"}` : "") +
        (mb.length ? ` · ${combo ? `<span class="num">${mb.length}</span> members` : "member of a combination"}` : "") +
        (hidden ? ` · <span class="num">${hidden}</span> hidden by the filters` : "");
      if (far) note = `<p class="st-note"><span class="lgl"><i></i>one step</span><span class="lgl"><i class="far"></i>further steps</span><span>${HONEST}</span></p>`;
    } else if ((t === "e" || t === "f") && p.rows.has(id)) {
      main = `Selected ${kindWord(p, id).toLowerCase()}: <b>${esc(title(p, id))}</b>`;
    } else if (t === "g" && p.gapRows.has(id)) {
      main = `Selected gap: <b>${esc(gapTitle(p, id))}</b>`;
    } else if (t === "p") {
      main = `Selected paper. Its ${p.it === "f" ? "findings" : "edges"} stay bright.`;
    } else if (t === "c") {
      main = `Selected claim. The ${p.it === "f" ? "finding" : "edge"} that pools it stays bright.`;
    }
    p.st.innerHTML = `<p class="st-main">${main}<button type="button" class="st-x" data-clear>Clear</button><button type="button" class="st-go" data-go>Details below</button></p>${note}`;
  }

  // ------------------------------------------------------------ drawer
  function drawerHTML(p, t, id) {
    if (t === "e" || t === "f") {
      const e = info(p, id);
      if (!e) return null;
      const claims = p.data ? papersHTML(p, e.ids) : waitHTML(p, `the ${plural(e.claims, "claim", "claims")}`, anchor(p, id));
      return [kindWord(p, id), esc(title(p, id)), edgeHead(p, e) + claims];
    }
    if (t === "g") {
      const tr = p.gapRows.get(id);
      if (!tr) return null;
      return ["Gap", `${esc(label(p, tr.dataset.s))} → ${esc(label(p, tr.dataset.t))}`, `<p class="gapnote">No study in this corpus tested this pairing. This is a gap, not a negative result.</p><h4>Searched for</h4><p class="read">${esc(tr.cells[3].textContent)}</p>`];
    }
    if (t === "n") {
      const g = p.nodes.get(id);
      if (!g) return null;
      const { out, inn } = nodeEdges(p, id);
      const mids = (g.dataset.members || "").split(" ");
      const mem = $$(".mt", g).map((x, i) => `<li>${btn(`n:${mids[i]}`, esc(x.textContent))}</li>`).join("");
      const combos = $$(".mb", p.svg).filter((m) => m.dataset.s === id).map((m) => `<li>${btn(`n:${m.dataset.t}`, esc(label(p, m.dataset.t)))}</li>`).join("");
      const tgt = (e) => { const d = p.rows.get(e).dataset; return isEdgeTarget(p, d.t) ? `changes the effect: ${title(p, d.t)}` : label(p, d.t); };
      const sel = p.sel && p.sel.node === id ? p.sel : null;
      const further = sel ? [...sel.act].filter(([, far]) => far).map(([eid]) => eid) : [];
      const gaps = sel ? sel.gaps : [];
      const W = p.it === "f" ? "Findings" : "Edges";
      return ["Node", esc(g.dataset.label),
        `<p class="muted">${esc(g.dataset.kind)}</p>` +
        (mem ? `<h4>Members</h4><ul class="mini">${mem}</ul>` : "") +
        (combos ? `<h4>Member of</h4><ul class="mini">${combos}</ul>` : "") +
        (g.classList.contains("k-condition") && p.note ? `<p class="note">${p.note.innerHTML}</p>` : "") +
        `<h4>${W} in (${inn.length})</h4><ul class="mini">${inn.map((e) => edgeLine(p, e, `from ${label(p, p.rows.get(e).dataset.s)}`)).join("") || "<li>None</li>"}</ul>` +
        `<h4>${W} out (${out.length})</h4><ul class="mini">${out.map((e) => edgeLine(p, e, `to ${tgt(e)}`)).join("") || "<li>None</li>"}</ul>` +
        (gaps.length ? `<h4>Gaps (${gaps.length})</h4><ul class="mini">${gaps.map((gid) => `<li>${btn(`g:${gid}`, esc(gapTitle(p, gid)))}</li>`).join("")}</ul>` : "") +
        (further.length ? `<h4>Further along its pathways (${further.length})</h4><p class="muted">${HONEST}</p><ul class="mini">${further.map((eid) => edgeLine(p, eid, title(p, eid))).join("")}</ul>` : "")];
    }
    if (t === "p") {
      const pr = paperRow(p, id);
      if (!pr) return null;
      const cites = $$("a.cite", pr.tr.cells[4]).map((a) => `<li>${btn(pinOf($(a.getAttribute("href"))), esc(a.textContent))}</li>`).join("");
      let claims = waitHTML(p, "its claims");
      if (p.data) {
        const pi = p.data.papers.findIndex((x) => x.doc === id);
        const ids = Object.keys(p.data.claims).filter((c) => p.data.claims[c].pp === pi);
        claims = `<h4>Claims (${ids.length})</h4><ol>${ids.map((c) => claimHTML(p, c)).join("")}</ol>`;
      }
      return ["Paper", pr.title, `<p>${esc(pr.year)} · ${pr.doi}</p><h4>Cited by</h4><ul class="mini">${cites || "<li>Interaction claims only</li>"}</ul>${claims}`];
    }
    if (t === "c") {
      if (p.data && !p.data.claims[id]) return null;
      const by = pooledIn(p, id);
      const pooled = `<h4>Pooled in</h4><ul class="mini">${by.map((e) => `<li>${btn(`${p.it}:${e}`, esc(title(p, e)))}</li>`).join("") || "<li>No pooled finding: this is an interaction claim, listed on its own.</li>"}</ul>`;
      if (!p.data) return ["Claim", "Claim and source sentence", waitHTML(p, "the claim") + pooled];
      const pp = p.data.papers[p.data.claims[id].pp];
      return ["Claim", "Claim and source sentence", `<ol>${claimHTML(p, id)}</ol><h4>Paper</h4><p>${rich(pp.title)} (${yearH(pp.year)}) · ${doiH(pp)}</p>${pooled}`];
    }
    return null;
  }
  const needsData = (t) => t === "e" || t === "f" || t === "p" || t === "c";
  function renderDrawer(p) {
    const parts = p.pinned && drawerHTML(p, p.pinned[0], p.pinned.slice(2));
    if (!parts) return false;
    p.dr.innerHTML = `<div class="dr-head"><div><p class="kick">${parts[0]}</p><h3>${parts[1]}</h3></div><button type="button" class="dr-x" aria-label="Close details">Close</button></div>${parts[2]}`;
    p.dr.classList.add("open");
    p.dr.scrollTop = 0;
    return true;
  }
  const hashOf = (p) => (p.pinned ? `#${p.id}/${TYPES[p.pinned[0]]}/${p.pinned.slice(2).replace(/[%# ]/g, encodeURIComponent)}` : `#${p.id}`);
  const inView = (el) => { const b = el.getBoundingClientRect(); return b.top >= 0 && b.top < innerHeight - 80; };
  let opener = null;
  // from: "graph" (graph or matrix), "page" (tables, search, drawer links), "route" (URL hash)
  function pin(p, pinStr, from = "page") {
    const t = pinStr[0];
    const prev = p.pinned;
    p.pinned = pinStr;
    highlight(p);
    if (!renderDrawer(p)) {
      p.pinned = prev;
      highlight(p);
      return;
    }
    if (from !== "route") opener = document.activeElement;
    $$("tr.pinned", p.sec).forEach((r) => r.classList.remove("pinned"));
    const id = pinStr.slice(2);
    const row = t === "g" ? p.gapRows.get(id) : t === "c" ? p.claimRows.find((r) => r.dataset.cid === id) : p.rows.get(id);
    if (row) row.classList.add("pinned");
    history.replaceState(null, "", hashOf(p));
    const refill = () => { if (p.pinned === pinStr && !renderDrawer(p)) unpin(p, false); };
    if (needsData(t) && !p.data) load(p).then(refill, refill);
    if (from === "route") return p.work.scrollIntoView({ block: "start" });
    // A node stays focused: the status line (aria-live) says what is bright.
    if (from === "graph" && t === "n") return;
    p.dr.focus({ preventScroll: true });
    if (from === "page" && !inView(narrow() ? p.dr : p.work)) (narrow() ? p.dr : p.work).scrollIntoView({ block: "start", behavior: smooth() });
  }
  function unpin(p, focus = true) {
    p.pinned = null;
    p.dr.classList.remove("open");
    p.dr.innerHTML = p.drHint;
    $$("tr.pinned", p.sec).forEach((r) => r.classList.remove("pinned"));
    highlight(p);
    history.replaceState(null, "", hashOf(p));
    if (focus && opener && opener !== document.body && document.contains(opener)) opener.focus();
    opener = null;
  }
  function pinOf(el) {
    if (!el) return null;
    if (el.dataset.pin) return el.dataset.pin;
    const tr = el.closest("tr");
    if (!tr) return null;
    const d = tr.dataset;
    if (d.pin) return d.pin;
    if (d.findingId) return `f:${d.findingId}`;
    if (d.edgeId) return `e:${d.edgeId}`;
    if (d.gapId) return `g:${d.gapId}`;
    if (d.cid) return `c:${d.cid}`;
    if (d.doc) return `p:${d.doc}`;
    return null;
  }

  // ------------------------------------------------------------ claims table (on demand)
  function renderClaims(p) {
    if (!p.data || p.cbox.dataset.done) return;
    p.cbox.dataset.done = "1";
    const { papers, claims } = p.data;
    const by = papers.map(() => []);
    for (const cid of Object.keys(claims)) by[claims[cid].pp].push(cid);
    let n = 0;
    const body = papers.map((pp, i) => {
      const head = `<tbody data-doc="${esc(pp.doc)}"${n >= PAGE ? ' class="x"' : ""}><tr class="ph"><th colspan="4" scope="rowgroup"><span class="pt">${rich(pp.title)}</span> (${yearH(pp.year)}) · ${doiH(pp)}</th></tr>`;
      return head + by[i].map((cid) => {
        const c = claims[cid];
        const x = n++ >= PAGE;
        return `<tr data-cid="${esc(cid)}" data-d="${esc(c.d)}" data-g="${CN[c.g] || 0}"${x ? ' class="x"' : ""}><th scope="row"><button type="button" class="rp">${soH(c)}</button><small>${c.m ? esc(c.m) : ""}</small></th><td class="d-${esc(c.d)}">${DW[c.d] || esc(c.d)}</td><td class="c${CN[c.g] || 0}">${CW[c.g] || esc(c.g)}</td><td><blockquote>${rich(c.q)}</blockquote></td></tr>`;
      }).join("") + "</tbody>";
    }).join("");
    p.cbox.innerHTML = `<table class="rt ct"><caption>Claims and their source sentences, grouped by paper. Select a claim to see the ${p.it === "f" ? "finding" : "edge"} that pools it.</caption><thead><tr><th scope="col">Claim</th><th scope="col">Direction</th><th scope="col">Grade</th><th scope="col">Quote</th></tr></thead>${body}</table><button type="button" class="more" data-more>Show all ${n} claims</button>`;
    p.claimRows = $$("tr[data-cid]", p.cbox);
    if (p.pinned && p.pinned[0] === "c") { const r = p.claimRows.find((x) => x.dataset.cid === p.pinned.slice(2)); if (r) r.classList.add("pinned"); }
    apply(p);
  }

  // ------------------------------------------------------------ filters, lens, search
  function apply(p) {
    let shown = 0;
    const m = p.match;
    p.rows.forEach((tr, id) => {
      const d = tr.dataset;
      const ok = p.dirs.has(d.direction) && (CN[d.certainty] || 0) >= p.minC;
      const miss = !!m && !m.items.has(id);
      tr.classList.toggle("flt", !ok);
      tr.classList.toggle("sm", ok && miss);
      if (ok && !miss) shown++;
      for (const el of p.byPin.get(`${p.it}:${id}`) || []) {
        const tgt = el.closest("td") || el;
        tgt.classList.toggle("flt", !ok);
        tgt.classList.toggle("sm", ok && miss);
        tgt.classList.toggle("lf", ok && p.lens !== "all" && d.lens !== p.lens);
      }
    });
    p.gapRows.forEach((tr, id) => {
      const miss = !!m && !m.gaps.has(id);
      tr.classList.toggle("flt", !p.gaps);
      tr.classList.toggle("sm", p.gaps && miss);
      for (const el of p.byPin.get(`g:${id}`) || []) {
        const tgt = el.closest("td") || el;
        tgt.classList.toggle("flt", !p.gaps);
        tgt.classList.toggle("sm", p.gaps && miss);
        tgt.classList.toggle("lf", p.lens !== "all");
      }
    });
    p.nodes.forEach((g, id) => g.classList.toggle("sm", !!m && !m.nodes.has(id)));
    $$(".mb,.dia", p.svg).forEach((el) => el.classList.toggle("lf", p.lens !== "all" && p.lens !== "inter"));
    for (const r of p.claimRows) r.classList.toggle("flt", !(p.dirs.has(r.dataset.d) && +r.dataset.g >= p.minC) || (!!m && !m.claims.has(r.dataset.cid)));
    $$("tbody", p.cbox).forEach((tb) => tb.classList.toggle("flt", !$$("tr:not(.ph):not(.flt)", tb).length));
    $$("tr[data-interaction-id]", p.sec).forEach((tr) => tr.classList.toggle("flt", !p.dirs.has(tr.dataset.direction)));
    $$(".pt tbody tr", p.sec).forEach((tr) => tr.classList.toggle("sm", !!m && !m.papers.has(tr.dataset.doc)));
    const active = !!m || p.dirs.size < DIRS.length || p.minC > 0;
    $$(".pg", p.sec).forEach((w) => w.classList.toggle("all", active || w.dataset.open === "1"));
    $("[data-count]", p.sec).textContent = shown;
    if (p.pinned && p.pinned[0] === "n") status(p);
  }
  function index(p) {
    if (p.idx && (p.idx.full || !p.data)) return p.idx;
    const lc = (s) => s.toLowerCase();
    const D = p.data;
    const claims = D ? Object.keys(D.claims).map((cid) => { const c = D.claims[cid]; return { cid, doc: D.papers[c.pp].doc, text: lc([c.s, c.p, c.o, c.m || "", c.q].join(" ")) }; }) : [];
    const docOf = new Map(claims.map((c) => [c.cid, c.doc]));
    const papers = $$(".pt tbody tr", p.sec).map((tr) => ({ doc: tr.dataset.doc, text: lc(tr.cells[0].textContent) }));
    const items = [...p.rows.keys()].map((id) => {
      const ids = p.rows.get(id).dataset.ids.split(" ");
      return { id, text: lc(title(p, id)), ids, docs: new Set(ids.map((c) => docOf.get(c))) };
    });
    const nodes = [...p.nodes.entries()].map(([id, g]) => ({ id, text: lc(g.dataset.label + " " + $$(".mt", g).map((x) => x.textContent).join(" ")) }));
    const gaps = [...p.gapRows.entries()].map(([id, tr]) => ({ id, text: lc(tr.textContent) }));
    return (p.idx = { full: !!D, claims, papers, items, nodes, gaps });
  }
  function search(p, raw) {
    const q = raw.trim().toLowerCase();
    if (!q) {
      p.match = null;
      p.sr.hidden = true;
      p.sr.innerHTML = "";
      return apply(p);
    }
    if (!p.data && !p.failed) {
      p.sr.hidden = false;
      p.sr.innerHTML = `<p class="muted">Loading the claims to search them…</p>`;
      load(p).then(() => search(p, p.q.value), () => search(p, p.q.value));
      return;
    }
    const ix = index(p);
    const claims = ix.claims.filter((c) => c.text.includes(q));
    const cset = new Set(claims.map((c) => c.cid));
    const papers = ix.papers.filter((x) => x.text.includes(q));
    const pset = new Set(papers.map((x) => x.doc));
    const items = ix.items.filter((x) => x.text.includes(q) || x.ids.some((c) => cset.has(c)) || [...x.docs].some((d) => pset.has(d)));
    const nodes = ix.nodes.filter((x) => x.text.includes(q));
    const gaps = ix.gaps.filter((x) => x.text.includes(q));
    const nset = new Set(nodes.map((x) => x.id));
    items.forEach((x) => { const d = p.rows.get(x.id).dataset; nset.add(d.s); nset.add(d.t); });
    gaps.forEach((x) => { const d = p.gapRows.get(x.id).dataset; nset.add(d.s); nset.add(d.t); });
    p.match = { items: new Set(items.map((x) => x.id)), nodes: nset, papers: new Set([...pset, ...claims.map((c) => c.doc)]), claims: cset, gaps: new Set(gaps.map((x) => x.id)) };
    const group = (name, list, f) => `<h4>${name} (${list.length})</h4>${list.length ? `<ul>${list.slice(0, 8).map(f).join("")}</ul>${list.length > 8 ? `<p class="muted">+${list.length - 8} more, shown in the tables below</p>` : ""}` : ""}`;
    p.sr.innerHTML =
      group("Nodes", nodes, (x) => `<li>${btn(`n:${x.id}`, esc(label(p, x.id)))}</li>`) +
      group(p.k === "a" ? "Findings" : "Edges", items, (x) => `<li>${btn(`${p.it}:${x.id}`, `<span class="dw d-${p.rows.get(x.id).dataset.direction}"></span> ${esc(title(p, x.id))}`)}</li>`) +
      (gaps.length ? group("Gaps", gaps, (x) => `<li>${btn(`g:${x.id}`, esc(gapTitle(p, x.id)))}</li>`) : "") +
      group("Papers", papers, (x) => `<li>${btn(`p:${x.doc}`, paperRow(p, x.doc).title)}</li>`) +
      (p.data ? group("Claims", claims, (x) => `<li>${btn(`c:${x.cid}`, soH(p.data.claims[x.cid]))}</li>`) : `<p class="muted">Claims could not be loaded, so quotes were not searched. They are on the ${claimsPage(p)}.</p>`);
    p.sr.hidden = false;
    apply(p);
  }

  // ------------------------------------------------------------ tabs and routing
  const cards = $$("#cards .card");
  function select(id, { hash = true, focusTab = false } = {}) {
    root.dataset.p = id;
    cards.forEach((c) => {
      const on = c.dataset.tab === id;
      c.setAttribute("aria-selected", on);
      c.tabIndex = on ? 0 : -1;
      if (on && focusTab) c.focus();
    });
    const p = Object.values(P).find((x) => x.id === id);
    if (hash && p) history.replaceState(null, "", hashOf(p));
  }
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [pid, type, ...rest] = h.split("/");
    const p = Object.values(P).find((x) => x.id === pid);
    if (!p) return select(root.dataset.p || "findings", { hash: false });
    select(pid, { hash: false });
    const t = Object.keys(TYPES).find((k) => TYPES[k] === type);
    if (t && rest.length) pin(p, `${t}:${rest.join("/")}`, "route");
  }

  // ------------------------------------------------------------ wiring
  $$(".panel").forEach((sec) => (P[sec.dataset.panel] = setup(sec)));
  const cardBox = $("#cards");
  cardBox.setAttribute("role", "tablist");
  cardBox.setAttribute("aria-label", "Panels");
  cards.forEach((c) => {
    c.setAttribute("role", "tab");
    c.setAttribute("aria-controls", c.dataset.tab);
    const sec = document.getElementById(c.dataset.tab);
    sec.setAttribute("role", "tabpanel");
    sec.setAttribute("aria-labelledby", c.id);
    c.addEventListener("click", (e) => { e.preventDefault(); select(c.dataset.tab); });
    c.addEventListener("keydown", (e) => {
      const i = cards.indexOf(c);
      const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: cards.length - 1 }[e.key];
      if (j === undefined) return;
      e.preventDefault();
      select(cards[(j + cards.length) % cards.length].dataset.tab, { focusTab: true });
    });
  });

  for (const p of Object.values(P)) {
    const sec = p.sec;
    // Select from the graph or the matrix; a second click on the selected
    // item, or a click on empty canvas, clears the selection.
    const fromView = (el, pinStr) => (pinStr === p.pinned ? unpin(p, false) : pin(p, pinStr, "graph"));
    sec.addEventListener("click", (e) => {
      const t = e.target.closest("button, a, .g [data-pin]");
      if (!t || (t.tagName === "A" && !t.matches("a.cite, a.rl"))) {
        if (t) return; // DOI and other plain links keep their default
        if (p.pinned && e.target.closest(".gs")) return unpin(p, false);
        // A click anywhere else in a table row selects that row (not while selecting text).
        const tr = e.target.closest(".tables tbody tr:not(.ph)");
        const ps = tr && getSelection().isCollapsed && pinOf(tr);
        if (ps) pin(p, ps, "page");
        return;
      }
      if (t.hasAttribute("data-clear") || t.classList.contains("dr-x")) return unpin(p);
      if (t.hasAttribute("data-go")) { p.dr.focus({ preventScroll: true }); p.dr.scrollIntoView({ block: "start", behavior: smooth() }); return; }
      const isBtn = t.tagName === "BUTTON";
      if (isBtn && t.dataset.lens) {
        p.lens = t.dataset.lens;
        $$("[data-lens]", t.parentElement).forEach((b) => b.setAttribute("aria-pressed", b === t));
        return apply(p);
      }
      if (isBtn && t.dataset.dir) {
        const on = t.getAttribute("aria-pressed") !== "true";
        t.setAttribute("aria-pressed", on);
        p.dirs[on ? "add" : "delete"](t.dataset.dir);
        return apply(p);
      }
      if (isBtn && t.dataset.view) {
        $$("[data-view]", t.parentElement).forEach((b) => b.setAttribute("aria-pressed", b === t));
        t.closest(".view").dataset.view = t.dataset.view;
        return;
      }
      if (isBtn && t.dataset.sort) return sort(t);
      if (t.hasAttribute("data-more")) {
        const w = t.closest(".pg");
        w.dataset.open = "1";
        w.classList.add("all");
        return;
      }
      const el = t.matches("a.cite") ? $(t.getAttribute("href")) : t;
      const pinStr = pinOf(el);
      if (!pinStr) return;
      e.preventDefault();
      if (t.closest(".view")) fromView(t, pinStr);
      else pin(p, pinStr, "page");
    });
    sec.addEventListener("keydown", (e) => {
      const el = e.target.closest && e.target.closest(".g [data-pin]");
      if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fromView(el, el.dataset.pin); }
    });
    $("[data-mincert]", sec).addEventListener("change", (e) => { p.minC = +e.target.value; apply(p); });
    $("[data-showgaps]", sec).addEventListener("change", (e) => { p.gaps = e.target.checked; apply(p); });
    let timer;
    p.q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => search(p, p.q.value), 120); });
    p.sr.setAttribute("role", "region");
    p.sr.setAttribute("aria-label", "Search results");
    // The claims table loads its data the first time it is opened.
    const det = $("details[data-claims]", sec);
    det.open = false;
    det.addEventListener("toggle", () => {
      if (!det.open || p.cbox.dataset.done) return;
      if (p.data) return renderClaims(p);
      p.cbox.innerHTML = `<p class="wait">Loading the claims…</p>`;
      load(p).then(() => renderClaims(p), () => { p.cbox.innerHTML = `<p class="wait">Could not load the claims here. Read them on the ${claimsPage(p)}.</p>`; });
    });
  }

  function sort(b) {
    const th = b.closest("th"), table = b.closest("table"), tb = table.tBodies[0];
    const asc = th.getAttribute("aria-sort") !== "ascending";
    $$("thead th", table).forEach((x) => x.hasAttribute("aria-sort") && x.setAttribute("aria-sort", "none"));
    th.setAttribute("aria-sort", asc ? "ascending" : "descending");
    const k = b.dataset.sort;
    const key = (tr) => /^\d$/.test(k) ? tr.cells[+k].textContent.trim().toLowerCase() : k === "direction" ? DIRS.indexOf(tr.dataset.direction) : k === "certainty" ? CN[tr.dataset.certainty] : +tr.dataset[k];
    const rows = [...tb.rows].map((tr, i) => [key(tr), i, tr]);
    rows.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1]) * (asc ? 1 : -1));
    rows.forEach((r) => tb.appendChild(r[2]));
  }

  document.addEventListener("keydown", (e) => {
    const p = P[root.dataset.p === "network" ? "b" : "a"];
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === "/" && !typing) { e.preventDefault(); p.q.focus(); return; }
    if (e.key !== "Escape") return;
    if (document.activeElement === p.q && p.q.value) { p.q.value = ""; search(p, ""); return; }
    if (p.pinned) unpin(p);
  });
  addEventListener("hashchange", route);
  route();
})();
