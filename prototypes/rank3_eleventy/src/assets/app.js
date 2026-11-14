// Q1 site, client side. Adds tabs, hover cards, the drawer, search, lenses,
// filters, the matrix toggle and table sorting. All data is read from the
// page itself (table rows and the SVG); nothing is fetched.
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const DIRS = ["increase", "decrease", "mixed", "no_effect", "unclear"];
  const DW = { increase: "Increase", decrease: "Decrease", mixed: "Mixed (studies disagree)", no_effect: "No effect (tested)", unclear: "Unclear" };
  const DG = { increase: "↑", decrease: "↓", mixed: "↕", no_effect: "=", unclear: "?" };
  const CN = { high: 4, moderate: 3, low: 2, very_low: 1 };
  const CW = { high: "High", moderate: "Moderate", low: "Low", very_low: "Very low" };
  const TYPES = { e: "edge", f: "finding", n: "node", g: "gap", p: "paper", c: "claim" };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const dirH = (d) => `<span class="dw d-${d}">${DW[d] || esc(d)}</span>`;
  const certH = (c) => `<span class="cw c${CN[c] || 0}">${CW[c] || esc(c)}</span>`;
  const btn = (pin, html, cls = "lnk") => `<button type="button" class="${cls}" data-pin="${esc(pin)}">${html}</button>`;
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const root = document.documentElement;
  const card = $("#hc");
  const P = {};

  // ------------------------------------------------------------ panel data
  function setup(sec) {
    const k = sec.dataset.panel;
    const p = { k, sec, id: sec.id, svg: $(`#${k}-svg`), dr: $(`#${k}-dr`), q: $(`#${k}-q`), sr: $(`#${k}-sr`), it: k === "a" ? "f" : "e", lens: "all", dirs: new Set(DIRS), minC: 0, gaps: true, match: null, pinned: null };
    p.rows = new Map($$("tr[data-finding-id],tr[data-edge-id]", sec).map((tr) => [tr.dataset.findingId || tr.dataset.edgeId, tr]));
    p.gapRows = new Map($$("tr[data-gap-id]", sec).map((tr) => [tr.dataset.gapId, tr]));
    p.nodes = new Map($$(".node", p.svg).map((g) => [g.dataset.pin.slice(2), g]));
    p.byPin = new Map();
    for (const el of $$("[data-pin]", p.svg).concat($$(".mx [data-pin]", sec))) {
      if (!p.byPin.has(el.dataset.pin)) p.byPin.set(el.dataset.pin, []);
      p.byPin.get(el.dataset.pin).push(el);
    }
    p.claimRows = $$(`.ct tbody tr:not(.ph)`, sec);
    p.note = $(".note", sec);
    return p;
  }
  const label = (p, id) => (p.nodes.get(id) ? p.nodes.get(id).dataset.label : id);
  const isEdgeTarget = (p, t) => !p.nodes.has(t) && p.rows.has(t);
  function title(p, id) {
    const d = p.rows.get(id).dataset;
    return isEdgeTarget(p, d.t) ? `${label(p, d.s)} changes the effect: ${title(p, d.t)}` : `${label(p, d.s)} → ${label(p, d.t)}`;
  }
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
  const claimRow = (p, cid) => document.getElementById(`${p.k}-c-${cid}`);
  const docOf = (row) => row.parentElement.dataset.doc;
  function paper(p, doc) {
    const tr = $$("tr[data-doc]", p.sec).find((r) => r.dataset.doc === doc && r.id.startsWith(`${p.k}-p-`));
    return tr && { tr, title: tr.cells[0].querySelector("button").innerHTML, year: tr.cells[1].textContent, doi: tr.cells[2].innerHTML, n: +tr.cells[3].textContent };
  }
  function docsFor(p, ids) {
    const m = new Map();
    ids.forEach((cid, i) => {
      const r = claimRow(p, cid);
      if (!r) return;
      const d = docOf(r);
      if (!m.has(d)) m.set(d, { doc: d, first: i, ids: [] });
      m.get(d).ids.push(cid);
    });
    return [...m.values()].sort((a, b) => b.ids.length - a.ids.length || a.first - b.first);
  }

  // ------------------------------------------------------------ html parts
  function claimHTML(p, cid) {
    const r = claimRow(p, cid);
    if (!r) return "";
    const th = r.cells[0].cloneNode(true);
    const meta = th.querySelector("small");
    meta.remove();
    const dir = r.cells[1].className.slice(2);
    const g = Object.keys(CN).find((k) => `c${CN[k]}` === r.cells[2].className);
    return `<li><p class="so">${th.innerHTML}</p><div class="kv">${dirH(dir)}<span>grade ${certH(g)}</span></div><small>${esc(meta.textContent)} · <span class="mono">${esc(cid)}</span></small>${r.cells[3].innerHTML}</li>`;
  }
  function sdHTML(sd) {
    const tot = sd.reduce((a, [, n]) => a + n, 0) || 1;
    return `<div class="sdbar" aria-hidden="true">${sd.map(([k, n]) => `<span class="d-${k}" style="flex:${n / tot}"></span>`).join("")}</div><div class="kv">${sd.map(([k, n]) => `<span class="s d-${k}">${DW[k] || esc(k)} ${n}</span>`).join("")}</div>`;
  }
  function edgeHead(p, e) {
    const mod = isEdgeTarget(p, e.t);
    return `<div class="kv">${dirH(e.dir)}${certH(e.cert)}<span>${plural(e.studies, "study", "studies")} · ${plural(e.claims, "claim", "claims")}</span></div>` +
      (mod ? `<p>${esc(e.meaning)}</p><p>Target edge: ${btn(`e:${e.t}`, esc(title(p, e.t)))}</p>` : "") +
      `<p><b>Certainty rationale:</b> ${esc(e.rationale)}</p><p class="muted">Study directions (studies)</p>${sdHTML(e.sd)}`;
  }
  const kindWord = (p, e) => (p.k === "a" ? "Finding" : isEdgeTarget(p, e.t) ? "Moderation edge" : "Edge");
  function nodeEdges(p, id) {
    const out = [], inn = [];
    p.rows.forEach((tr, eid) => {
      if (tr.dataset.s === id) out.push(eid);
      else if (tr.dataset.t === id) inn.push(eid);
    });
    return { out, inn };
  }
  function edgeLine(p, eid, other) {
    const d = p.rows.get(eid).dataset;
    return `<li>${btn(`${p.it}:${eid}`, `<span class="dw d-${d.direction}"></span><span class="cw c${CN[d.certainty]}"></span><span class="vh">${DW[d.direction]}, certainty ${CW[d.certainty]},</span> ${esc(other)}`)}</li>`;
  }

  // ------------------------------------------------------------ hover card
  function cardHTML(p, pin) {
    const [t, id] = [pin[0], pin.slice(2)];
    if (t === "e" || t === "f") {
      const e = info(p, id);
      const docs = docsFor(p, e.ids);
      const tops = docs.slice(0, 3).map((x) => { const pp = paper(p, x.doc); return `<li>${pp ? `${pp.title} (${esc(pp.year)})` : esc(x.doc)}</li>`; }).join("");
      return `<h4>${esc(title(p, id))}</h4>${edgeHead(p, e)}<ul>${tops}</ul>${docs.length > 3 ? `<p class="muted">+${docs.length - 3} more papers</p>` : ""}<p class="cf">Click to pin and read the quotes</p>`;
    }
    if (t === "g") {
      const tr = p.gapRows.get(id);
      return `<h4>${esc(label(p, tr.dataset.s))} → ${esc(label(p, tr.dataset.t))}</h4><p class="gapnote">No study in this corpus tested this pairing. This is a gap, not a negative result.</p><p><b>Searched for:</b> ${esc(tr.cells[3].textContent)}</p>`;
    }
    if (t === "n") {
      const g = p.nodes.get(id);
      const { out, inn } = nodeEdges(p, id);
      const mem = $$(".mt", g).map((x) => `<li>${esc(x.textContent)}</li>`).join("");
      const cond = g.classList.contains("k-condition");
      const lines = [...inn.map((e) => edgeLine(p, e, `from ${label(p, p.rows.get(e).dataset.s)}`)), ...out.map((e) => edgeLine(p, e, `to ${isEdgeTarget(p, p.rows.get(e).dataset.t) ? title(p, p.rows.get(e).dataset.t) : label(p, p.rows.get(e).dataset.t)}`))];
      return `<h4>${esc(g.dataset.label)}</h4><p class="muted">${esc(g.dataset.kind)}</p>${mem ? `<p>Members:</p><ul>${mem}</ul>` : ""}<p>${plural(inn.length, "edge", "edges")} in · ${plural(out.length, "edge", "edges")} out</p>${lines.length ? `<ul class="mini">${lines.join("")}</ul>` : ""}${cond ? `<p class="muted">Edges in: dashed. Edges out: solid.</p><p>${esc(p.note.textContent)}</p>` : ""}`;
    }
    return "";
  }
  function showCard(p, pin, x, y) {
    const html = cardHTML(p, pin);
    if (!html) return hideCard();
    card.innerHTML = html;
    card.hidden = false;
    const w = card.offsetWidth, h = card.offsetHeight, vw = innerWidth, vh = innerHeight;
    let L = x + 16, T = y + 16;
    if (L + w > vw - 8) L = Math.max(8, x - w - 16);
    if (T + h > vh - 8) T = Math.max(8, vh - h - 8);
    card.style.left = `${L}px`;
    card.style.top = `${T}px`;
  }
  const hideCard = () => (card.hidden = true);

  // ------------------------------------------------------------ highlight
  function highlight(p, pin) {
    $$(".on,.hin,.hout", p.svg).forEach((el) => el.classList.remove("on", "hin", "hout"));
    p.svg.classList.toggle("hl", !!pin);
    if (!pin) return;
    const on = (k) => (p.byPin.get(k) || []).forEach((el) => el.closest("svg") && el.classList.add("on"));
    const [t, id] = [pin[0], pin.slice(2)];
    on(pin);
    if (t === "e" || t === "f") {
      const d = p.rows.get(id).dataset;
      on(`n:${d.s}`);
      if (isEdgeTarget(p, d.t)) { on(`${p.it}:${d.t}`); const d2 = p.rows.get(d.t).dataset; on(`n:${d2.s}`); on(`n:${d2.t}`); } else on(`n:${d.t}`);
      p.rows.forEach((tr, eid) => tr.dataset.t === id && on(`${p.it}:${eid}`));
    } else if (t === "g") {
      const d = p.gapRows.get(id).dataset;
      on(`n:${d.s}`);
      on(`n:${d.t}`);
    } else if (t === "n") {
      const cond = p.nodes.get(id).classList.contains("k-condition");
      p.rows.forEach((tr, eid) => {
        const d = tr.dataset;
        if (d.s !== id && d.t !== id) return;
        on(`${p.it}:${eid}`);
        on(`n:${d.s === id ? d.t : d.s}`);
        if (isEdgeTarget(p, d.t)) on(`${p.it}:${d.t}`);
        if (cond) (p.byPin.get(`${p.it}:${eid}`) || []).forEach((el) => el.classList.add(d.t === id ? "hin" : "hout"));
      });
      p.gapRows.forEach((tr, gid) => (tr.dataset.s === id || tr.dataset.t === id) && (on(`g:${gid}`), on(`n:${tr.dataset.s === id ? tr.dataset.t : tr.dataset.s}`)));
      $$(".mb", p.svg).forEach((m) => {
        if (m.dataset.s === id || m.dataset.t === id) { m.classList.add("on"); on(`n:${m.dataset.s}`); on(`n:${m.dataset.t}`); }
      });
    }
  }
  const restore = (p) => highlight(p, p.pinned);

  // ------------------------------------------------------------ drawer
  function drawerHTML(p, t, id) {
    if (t === "e" || t === "f") {
      const e = info(p, id);
      if (!e) return null;
      const groups = docsFor(p, e.ids).map((x) => {
        const pp = paper(p, x.doc);
        return `<section><h4>${pp ? pp.title : esc(x.doc)}</h4><p class="muted">${pp ? `${esc(pp.year)} · ${pp.doi}` : ""} · ${plural(x.ids.length, "claim", "claims")} here</p><ol>${x.ids.map((c) => claimHTML(p, c)).join("")}</ol></section>`;
      });
      return [kindWord(p, e), esc(title(p, id)), `${edgeHead(p, e)}<h4>Claims by paper (${groups.length} ${groups.length === 1 ? "paper" : "papers"})</h4>${groups.join("")}`];
    }
    if (t === "g") {
      const tr = p.gapRows.get(id);
      if (!tr) return null;
      return ["Gap", `${esc(label(p, tr.dataset.s))} → ${esc(label(p, tr.dataset.t))}`, `<p class="gapnote">No study in this corpus tested this pairing. This is a gap, not a negative result.</p><h4>Searched for</h4><p>${esc(tr.cells[3].textContent)}</p>`];
    }
    if (t === "n") {
      const g = p.nodes.get(id);
      if (!g) return null;
      const { out, inn } = nodeEdges(p, id);
      const mids = (g.dataset.members || "").split(" ");
      const mem = $$(".mt", g).map((x, i) => `<li>${btn(`n:${mids[i]}`, esc(x.textContent))}</li>`).join("");
      const tgt = (e) => { const d = p.rows.get(e).dataset; return isEdgeTarget(p, d.t) ? `changes the effect: ${title(p, d.t)}` : label(p, d.t); };
      return ["Node", esc(g.dataset.label), `<p class="muted">${esc(g.dataset.kind)}</p>${mem ? `<h4>Members</h4><ul class="mini">${mem}</ul>` : ""}${g.classList.contains("k-condition") ? `<p class="note">${p.note.innerHTML}</p>` : ""}<h4>Edges in (${inn.length})</h4><ul class="mini">${inn.map((e) => edgeLine(p, e, `from ${label(p, p.rows.get(e).dataset.s)}`)).join("") || "<li>None</li>"}</ul><h4>Edges out (${out.length})</h4><ul class="mini">${out.map((e) => edgeLine(p, e, `to ${tgt(e)}`)).join("") || "<li>None</li>"}</ul>`];
    }
    if (t === "p") {
      const pp = paper(p, id);
      if (!pp) return null;
      const cites = $$("a.cite", pp.tr.cells[4]).map((a) => `<li>${btn(pinOf($(a.getAttribute("href"))), esc(a.textContent))}</li>`).join("");
      const ids = p.claimRows.filter((r) => docOf(r) === id).map((r) => r.id.slice(4));
      return ["Paper", pp.title, `<p>${esc(pp.year)} · ${pp.doi}</p><h4>Cited by</h4><ul class="mini">${cites || "<li>Interaction claims only</li>"}</ul><h4>Claims (${ids.length})</h4><ol>${ids.map((c) => claimHTML(p, c)).join("")}</ol>`];
    }
    if (t === "c") {
      const r = claimRow(p, id);
      if (!r) return null;
      const pp = paper(p, docOf(r));
      const by = [...p.rows.keys()].filter((e) => p.rows.get(e).dataset.ids.split(" ").includes(id));
      return ["Claim", "Claim and source sentence", `<ol>${claimHTML(p, id)}</ol><h4>Paper</h4><p>${pp ? `${pp.title} (${esc(pp.year)}) · ${pp.doi}` : ""}</p><h4>Pooled in</h4><ul class="mini">${by.map((e) => `<li>${btn(`${p.it}:${e}`, esc(title(p, e)))}</li>`).join("") || "<li>No pooled finding: this is an interaction claim, listed on its own.</li>"}</ul>`];
    }
    return null;
  }
  let opener = null;
  function pin(p, pinStr, { focus = true, hash = true } = {}) {
    const t = pinStr[0], id = pinStr.slice(2);
    const parts = drawerHTML(p, t, id);
    if (!parts) return;
    if (focus) opener = document.activeElement;
    p.pinned = pinStr;
    p.dr.innerHTML = `<div class="dr-head"><div><p class="kick">${parts[0]}</p><h3>${parts[1]}</h3></div><button type="button" class="dr-x" aria-label="Close details">Close</button></div>${parts[2]}`;
    p.dr.classList.add("open");
    p.dr.scrollTop = 0;
    $$("tr.pinned", p.sec).forEach((r) => r.classList.remove("pinned"));
    const row = t === "g" ? p.gapRows.get(id) : t === "c" ? claimRow(p, id) : p.rows.get(id);
    if (row) row.classList.add("pinned");
    restore(p);
    if (hash) history.replaceState(null, "", `#${p.id}/${TYPES[t]}/${id.replace(/[%# ]/g, encodeURIComponent)}`);
    if (focus) p.dr.focus({ preventScroll: innerWidth > 960 });
  }
  function unpin(p) {
    p.pinned = null;
    p.dr.classList.remove("open");
    p.dr.innerHTML = `<p class="hint">Select a chip, a node or a table row. Its claims and their source sentences open here.</p>`;
    $$("tr.pinned", p.sec).forEach((r) => r.classList.remove("pinned"));
    restore(p);
    history.replaceState(null, "", `#${p.id}`);
    if (opener && document.contains(opener)) opener.focus();
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
    if (d.doc) return `p:${d.doc}`;
    if (tr.id.includes("-c-")) return `c:${tr.id.slice(4)}`;
    return null;
  }

  // ------------------------------------------------------------ filters, lens, search
  function apply(p) {
    let shown = 0;
    const m = p.match;
    const lensOn = (el, lens) => p.lens !== "all" && lens !== p.lens;
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
        tgt.classList.toggle("lf", ok && lensOn(el, d.lens));
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
    for (const r of p.claimRows) {
      const dir = r.cells[1].className.slice(2);
      const n = +r.cells[2].className.slice(1);
      r.classList.toggle("flt", !(p.dirs.has(dir) && n >= p.minC) || (!!m && !m.claims.has(r.id.slice(4))));
    }
    $$(".ct tbody", p.sec).forEach((tb) => tb.classList.toggle("flt", !$$("tr:not(.ph):not(.flt)", tb).length));
    $$("tr[data-interaction-id]", p.sec).forEach((tr) => tr.classList.toggle("flt", !p.dirs.has(tr.dataset.direction)));
    $$(".pt tbody tr", p.sec).forEach((tr) => tr.classList.toggle("sm", !!m && !m.papers.has(tr.dataset.doc)));
    const active = !!m || p.dirs.size < DIRS.length || p.minC > 0;
    $$(".pg", p.sec).forEach((w) => w.classList.toggle("all", active || w.dataset.open === "1"));
    $("[data-count]", p.sec).textContent = shown;
  }
  function index(p) {
    if (p.idx) return p.idx;
    const lc = (s) => s.toLowerCase();
    const claims = p.claimRows.map((r) => ({ cid: r.id.slice(4), doc: docOf(r), text: lc(r.textContent) }));
    const byCid = new Map(claims.map((c) => [c.cid, c]));
    const papers = $$(".pt tbody tr", p.sec).map((tr) => ({ doc: tr.dataset.doc, text: lc(tr.cells[0].textContent) }));
    const items = [...p.rows.keys()].map((id) => {
      const ids = p.rows.get(id).dataset.ids.split(" ");
      return { id, text: lc(title(p, id)), ids, docs: new Set(ids.map((c) => (byCid.get(c) || {}).doc)) };
    });
    const nodes = [...p.nodes.entries()].map(([id, g]) => ({ id, text: lc(g.dataset.label + " " + $$(".mt", g).map((x) => x.textContent).join(" ")) }));
    const gaps = [...p.gapRows.entries()].map(([id, tr]) => ({ id, text: lc(tr.textContent) }));
    return (p.idx = { claims, papers, items, nodes, gaps });
  }
  function search(p, q) {
    q = q.trim().toLowerCase();
    if (!q) {
      p.match = null;
      p.sr.hidden = true;
      p.sr.innerHTML = "";
      return apply(p);
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
      (gaps.length ? group("Gaps", gaps, (x) => `<li>${btn(`g:${x.id}`, esc(title2(p, x.id)))}</li>`) : "") +
      group("Papers", papers, (x) => `<li>${btn(`p:${x.doc}`, paper(p, x.doc).title)}</li>`) +
      group("Claims", claims, (x) => { const r = claimRow(p, x.cid); const th = r.cells[0].cloneNode(true); th.querySelector("small").remove(); return `<li>${btn(`c:${x.cid}`, th.innerHTML)}</li>`; });
    p.sr.hidden = false;
    apply(p);
  }
  const title2 = (p, gid) => { const d = p.gapRows.get(gid).dataset; return `${label(p, d.s)} → ${label(p, d.t)} (no evidence)`; };

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
    hideCard();
    if (hash) history.replaceState(null, "", `#${id}`);
  }
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [pid, type, ...rest] = h.split("/");
    const p = Object.values(P).find((x) => x.id === pid);
    if (!p) return select(root.dataset.p || "findings", { hash: false });
    select(pid, { hash: false });
    const t = Object.keys(TYPES).find((k) => TYPES[k] === type);
    if (t && rest.length) pin(p, `${t}:${rest.join("/")}`, { focus: false, hash: false });
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
    // hover and focus on graph items and matrix cells
    const target = (e) => e.target.closest && e.target.closest(".g [data-pin], .mx [data-pin]");
    sec.addEventListener("pointerover", (e) => {
      const el = target(e);
      if (!el) return;
      highlight(p, el.dataset.pin);
      showCard(p, el.dataset.pin, e.clientX, e.clientY);
    });
    sec.addEventListener("pointermove", (e) => { if (!card.hidden && target(e)) showCard(p, target(e).dataset.pin, e.clientX, e.clientY); });
    sec.addEventListener("pointerout", (e) => {
      const el = target(e);
      if (el && !(e.relatedTarget && el.contains(e.relatedTarget))) { hideCard(); restore(p); }
    });
    sec.addEventListener("focusin", (e) => {
      const el = target(e);
      if (!el) return;
      highlight(p, el.dataset.pin);
      const b = el.getBoundingClientRect();
      showCard(p, el.dataset.pin, b.right, b.top);
    });
    sec.addEventListener("focusout", (e) => { if (target(e)) { hideCard(); restore(p); } });
    // clicks: pins, closes, lenses, filters, view toggle, sorting, show all
    sec.addEventListener("click", (e) => {
      const t = e.target.closest("button, a.cite, .g [data-pin]");
      if (!t) return;
      if (t.classList.contains("dr-x")) return unpin(p);
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
      hideCard();
      pin(p, pinStr);
    });
    sec.addEventListener("keydown", (e) => {
      const el = e.target.closest && e.target.closest(".g [data-pin]");
      if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); hideCard(); pin(p, el.dataset.pin); }
    });
    $("[data-mincert]", sec).addEventListener("change", (e) => { p.minC = +e.target.value; apply(p); });
    $("[data-showgaps]", sec).addEventListener("change", (e) => { p.gaps = e.target.checked; apply(p); });
    let timer;
    p.q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => search(p, p.q.value), 120); });
    p.sr.setAttribute("role", "region");
    p.sr.setAttribute("aria-label", "Search results");
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
    hideCard();
    if (document.activeElement === p.q && p.q.value) { p.q.value = ""; search(p, ""); return; }
    if (p.pinned) unpin(p);
  });
  addEventListener("hashchange", route);
  addEventListener("scroll", hideCard, { passive: true });
  route();
})();
