// Build-time model for the Q1 site.
// Reads the two answer objects and returns everything the templates draw:
// counts, table rows, matrix cells and the graph geometry (layered lanes,
// edge routes, chip positions). No value is re-derived: directions,
// certainty, counts and texts are copied from the JSON.

import { layoutGraph } from "./layout.js";

export const DIRS = {
  increase: { word: "Increase", glyph: "↑" },
  decrease: { word: "Decrease", glyph: "↓" },
  mixed: { word: "Mixed (studies disagree)", glyph: "↕" },
  no_effect: { word: "No effect (tested)", glyph: "=" },
  unclear: { word: "Unclear", glyph: "?" },
};
export const CERTS = {
  high: { word: "High", n: 4 },
  moderate: { word: "Moderate", n: 3 },
  low: { word: "Low", n: 2 },
  very_low: { word: "Very low", n: 1 },
};
const KIND_TITLE = {
  planting_stock: "Planting stock",
  site_treatment: "Site treatments",
  condition: "Conditions",
  outcome: "Outcomes",
  combination: "Combination",
};

export const dirWord = (d) => (DIRS[d] ? DIRS[d].word : String(d));
export const dirGlyph = (d) => (DIRS[d] ? DIRS[d].glyph : "?");
export const certWord = (c) => (CERTS[c] ? CERTS[c].word : String(c));
export const certN = (c) => (CERTS[c] ? CERTS[c].n : 0);
export const certDots = (c) => {
  const n = CERTS[c] ? CERTS[c].n : 0;
  return "●".repeat(n) + "○".repeat(4 - n);
};
const PAGE = 25;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const human = (s) => String(s).replace(/_/g, " ");

// "increase 5 · mixed 4" in fixed direction order, numbers printed.
function studyDirs(sd) {
  const keys = Object.keys(DIRS).filter((k) => sd[k]).concat(Object.keys(sd).filter((k) => !DIRS[k]));
  return keys.map((k) => ({ key: k, glyph: dirGlyph(k), word: dirWord(k), n: sd[k] }));
}

function countBy(items, key, order) {
  const m = new Map(order.map((k) => [k, 0]));
  for (const it of items) m.set(it[key], (m.get(it[key]) || 0) + 1);
  return [...m].filter(([, n]) => n > 0);
}

function edgeAria(srcLabel, tgtLabel, e) {
  return `${srcLabel} to ${tgtLabel}: ${dirWord(e.direction)}, certainty ${certWord(e.certainty)}, ${plural(e.studies, "study", "studies")}, ${plural(e.claims, "claim", "claims")}`;
}

// Papers: one per document_id, ordered by number of claims, then first seen.
function papersOf(evidence, citers) {
  const by = new Map();
  for (const [cid, ev] of Object.entries(evidence)) {
    if (!by.has(ev.document_id)) by.set(ev.document_id, { doc: ev.document_id, title: ev.title, year: ev.year, doi: ev.doi, claims: [] });
    by.get(ev.document_id).claims.push({ cid, ...ev, dir: { glyph: dirGlyph(ev.direction), word: dirWord(ev.direction) }, grade: { dots: certDots(ev.certainty_grade), word: certWord(ev.certainty_grade), n: certN(ev.certainty_grade) }, predicateText: human(ev.predicate), meta: [...(ev.evidence_types || []).map(human), ev.comparator ? human(ev.comparator) : null].filter(Boolean).join(" · ") });
  }
  const list = [...by.values()];
  list.forEach((p, i) => (p.first = i));
  list.sort((a, b) => b.claims.length - a.claims.length || a.first - b.first);
  let n = 0;
  list.forEach((p, i) => {
    p.idx = i;
    p.citedBy = citers.filter((c) => c.docs.includes(p.doc));
    p.extra = n >= PAGE; // pagination: rows after the first PAGE claims start hidden (JS only)
    for (const c of p.claims) c.extra = n++ >= PAGE;
  });
  return list;
}

function glance(items, gaps) {
  return {
    dirs: countBy(items, "direction", Object.keys(DIRS)).map(([k, n]) => ({ key: k, glyph: dirGlyph(k), word: dirWord(k), n })),
    certs: countBy(items, "certainty", Object.keys(CERTS)).map(([k, n]) => ({ key: k, dots: certDots(k), word: certWord(k), n, dn: certN(k) })),
    gaps: gaps.length,
  };
}

function rowOf(e, src, tgt, extra = {}) {
  return {
    id: e.id,
    src,
    tgt,
    direction: e.direction,
    certainty: e.certainty,
    studies: e.studies,
    claims: e.claims,
    dir: { glyph: dirGlyph(e.direction), word: dirWord(e.direction) },
    cert: { dots: certDots(e.certainty), word: certWord(e.certainty), n: certN(e.certainty) },
    rationale: e.certainty_rationale,
    sd: studyDirs(e.study_directions || {}),
    sdData: Object.entries(e.study_directions || {}).map(([k, n]) => `${k}:${n}`).join(" "),
    ids: e.edge_ids.join(" "),
    docs: e.document_ids,
    ...extra,
  };
}

// ---------------------------------------------------------------- Panel A
function panelA(A) {
  const nodes = new Map();
  const add = (n, lane) => { if (!nodes.has(n.id)) nodes.set(n.id, { id: n.id, label: n.label, lane }); };
  for (const f of [...A.findings, ...A.gaps]) add(f.subject, 0);
  for (const f of [...A.findings, ...A.gaps]) add(f.outcome, 1);
  const label = (id) => nodes.get(id).label;

  const rows = A.findings.map((f, i) =>
    rowOf(f, f.subject, f.outcome, { idx: i, pin: `f:${f.id}`, lens: f.outcome.id, aria: edgeAria(f.subject.label, f.outcome.label, f) }),
  );
  const gaps = A.gaps.map((g, i) => ({ id: g.id, idx: i, src: g.subject, tgt: g.outcome, status: g.status, studies: g.studies, searched_for: g.searched_for, pin: `g:${g.id}` }));
  const interactions = A.interactions.map((it, i) => {
    const ev = A.evidence[it.edge_id];
    return { id: it.edge_id, idx: i, direction: it.direction, dir: { glyph: dirGlyph(it.direction), word: dirWord(it.direction) }, ev: { ...ev, predicateText: human(ev.predicate) }, grade: { dots: certDots(ev.certainty_grade), word: certWord(ev.certainty_grade), n: certN(ev.certainty_grade) } };
  });
  const citers = rows.map((r) => ({ pin: r.pin, href: `#a-e-${r.idx}`, text: `${r.src.label} → ${r.tgt.label}`, docs: r.docs }));
  const papers = papersOf(A.evidence, citers);
  const interIds = new Set(A.interactions.map((i) => i.edge_id));
  for (const p of papers) for (const c of p.claims) c.interaction = interIds.has(c.cid);

  const graph = layoutGraph({
    panel: "a",
    lanes: [
      { groups: [{ title: "Factor", sub: [], nodes: [...nodes.values()].filter((n) => n.lane === 0) }] },
      { title: "Outcome", sub: [], groups: [{ nodes: [...nodes.values()].filter((n) => n.lane === 1) }] },
    ],
    fixedLane0: true,
    geo: { ml: 16, nodeW: 200, corr: 290, mr: 16, laneGap: [16, 90] },
    links: [
      ...A.findings.map((f, i) => ({ id: f.id, s: f.subject.id, t: f.outcome.id, kind: "effect", row: rows[i] })),
      ...A.gaps.map((g, i) => ({ id: g.id, s: g.subject.id, t: g.outcome.id, kind: "gap", gap: gaps[i] })),
    ],
  });
  for (const n of graph.nodes) {
    n.kindLine = n.lane === 0 ? "Factor" : "Outcome";
    n.aria = `${n.label}. ${n.lane === 0 ? "Factor" : "Outcome"}. ${plural(n.inN, "finding", "findings")} in, ${plural(n.outN, "finding", "findings")} out.`;
    n.pin = `n:${n.id}`;
  }

  const outcomes = [...nodes.values()].filter((n) => n.lane === 1);
  const factors = [...nodes.values()].filter((n) => n.lane === 0);
  const matrix = {
    cols: outcomes.map((o) => ({ id: o.id, label: o.label })),
    rows: factors.map((f) => ({
      id: f.id,
      label: f.label,
      cells: outcomes.map((o) => {
        const r = rows.find((x) => x.src.id === f.id && x.tgt.id === o.id);
        if (r) return { type: "edge", row: r };
        const g = gaps.find((x) => x.src.id === f.id && x.tgt.id === o.id);
        if (g) return { type: "gap", gap: g };
        return { type: "none" };
      }),
    })),
  };

  return {
    key: "a",
    id: "findings",
    name: "Findings",
    blurb: "Each planting-stock trait or site factor against seedling survival and growth.",
    question: A.question,
    rule: A.rule,
    howBuilt: A.how_built,
    limitations: A.limitations,
    itemWord: ["finding", "findings"],
    counts: { items: rows.length, gaps: gaps.length, claims: Object.keys(A.evidence).length, papers: papers.length, interactions: interactions.length },
    glance: glance(A.findings, A.gaps),
    lenses: [{ key: "all", label: "All" }, ...outcomes.map((o) => ({ key: o.id, label: o.label }))],
    rows,
    gaps,
    interactions,
    papers,
    graph,
    matrix,
    label,
  };
}

// ---------------------------------------------------------------- Panel B
function panelB(B) {
  const nodeMap = new Map(B.nodes.map((n) => [n.id, n]));
  const label = (id) => nodeMap.get(id).label;
  const kindOf = (id) => nodeMap.get(id).kind;
  const edgeMap = new Map(B.edges.map((e) => [e.id, e]));

  const lensOf = (e) => {
    if (e.kind === "moderation" || kindOf(e.source) === "combination") return "inter";
    if (kindOf(e.source) === "condition" || kindOf(e.target) === "condition") return "cond";
    if (kindOf(e.target) === "outcome") return "direct";
    return "other";
  };
  const rows = B.edges.map((e, i) => {
    const src = { id: e.source, label: label(e.source) };
    let tgt, aria;
    if (e.kind === "moderation") {
      const te = edgeMap.get(e.target_edge);
      const teText = te ? `${label(te.source)} → ${label(te.target)}` : e.target_edge;
      tgt = { id: null, label: teText, edge: e.target_edge, isEdge: true };
      aria = `${src.label} changes the effect ${teText}: ${dirWord(e.direction)}, certainty ${certWord(e.certainty)}, ${plural(e.studies, "study", "studies")}, ${plural(e.claims, "claim", "claims")}`;
    } else {
      tgt = { id: e.target, label: label(e.target) };
      aria = edgeAria(src.label, tgt.label, e);
    }
    return rowOf(e, src, tgt, { idx: i, kind: e.kind, pin: `e:${e.id}`, lens: lensOf(e), aria, direction_meaning: e.direction_meaning || null, target_edge: e.target_edge || null });
  });
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const gaps = B.gaps.map((g, i) => ({ id: g.id, idx: i, src: { id: g.source, label: label(g.source) }, tgt: { id: g.target, label: label(g.target) }, status: g.status, searched_for: g.searched_for, pin: `g:${g.id}` }));
  const citers = rows.map((r) => ({ pin: r.pin, href: `#b-e-${r.idx}`, text: `${r.src.label} → ${r.tgt.label}`, docs: r.docs }));
  const papers = papersOf(B.evidence, citers);

  const kinds = ["planting_stock", "site_treatment", "combination", "condition", "outcome"];
  const byKind = (k) => B.nodes.filter((n) => n.kind === k);
  const kindGroup = (k) => ({ kind: k, title: KIND_TITLE[k], sub: B.node_kinds[k] || "", nodes: byKind(k) });
  const known = new Set(kinds);
  const otherNodes = B.nodes.filter((n) => !known.has(n.kind));

  const effectLinks = B.edges.filter((e) => e.kind !== "moderation").map((e) => ({ id: e.id, s: e.source, t: e.target, kind: "effect", row: rowById.get(e.id) }));
  const graph = layoutGraph({
    panel: "b",
    lanes: [
      { groups: [kindGroup("planting_stock"), kindGroup("site_treatment"), kindGroup("combination"), ...(otherNodes.length ? [{ kind: "other", title: "Other", sub: "", nodes: otherNodes }] : [])] },
      { title: KIND_TITLE.condition, sub: B.node_kinds.condition || "", groups: [{ nodes: byKind("condition") }] },
      { title: KIND_TITLE.outcome, sub: B.node_kinds.outcome || "", groups: [{ nodes: byKind("outcome") }] },
    ],
    geo: { ml: 48, nodeW: 172, corr: [222, 186], mr: 18, laneGap: [16, 40, 90] },
    links: [...effectLinks, ...B.gaps.map((g, i) => ({ id: g.id, s: g.source, t: g.target, kind: "gap", gap: gaps[i] }))],
    moderations: B.edges.filter((e) => e.kind === "moderation").map((e) => ({ id: e.id, s: e.source, te: e.target_edge, row: rowById.get(e.id) })),
    memberships: B.nodes.filter((n) => n.kind === "combination").flatMap((n) => (n.members || []).map((m) => ({ s: m, t: n.id }))),
  });
  const inOut = (id) => {
    const ins = B.edges.filter((e) => e.target === id).length;
    const outs = B.edges.filter((e) => e.source === id).length;
    return [ins, outs];
  };
  for (const n of graph.nodes) {
    const k = kindOf(n.id);
    const [ins, outs] = inOut(n.id);
    n.kind = k;
    n.kindText = B.node_kinds[k] || k;
    n.members = (nodeMap.get(n.id).members || []).map((m, i) => ({ id: m, label: (i ? "+ " : "") + label(m) }));
    n.aria = `${n.label}. ${KIND_TITLE[k] || k}: ${n.kindText}. ${plural(ins, "edge", "edges")} in, ${plural(outs, "edge", "edges")} out.` + (n.members.length ? ` Members: ${n.members.map((m) => label(m.id)).join(" and ")}.` : "");
    n.pin = `n:${n.id}`;
    n.kindLine = `${KIND_TITLE[k] || k}: ${n.kindText}`;
  }

  // Matrix: rows = nodes with out-edges (lane order), columns = targets, plus one column per moderated edge.
  const laneOrder = graph.nodes.map((n) => n.id);
  const srcIds = laneOrder.filter((id) => B.edges.some((e) => e.source === id) || B.gaps.some((g) => g.source === id));
  const tgtIds = laneOrder.filter((id) => B.edges.some((e) => e.target === id) || B.gaps.some((g) => g.target === id));
  const modTargets = [...new Set(B.edges.filter((e) => e.kind === "moderation").map((e) => e.target_edge))];
  const cols = [
    ...tgtIds.map((id) => ({ id, label: label(id) })),
    ...modTargets.map((te) => ({ edge: te, label: rowById.get(te) ? `${rowById.get(te).src.label} → ${rowById.get(te).tgt.label}` : te, isEdge: true })),
  ];
  const matrix = {
    cols,
    rows: srcIds.map((sid) => ({
      id: sid,
      label: label(sid),
      cells: cols.map((c) => {
        if (c.isEdge) {
          const r = rows.find((x) => x.kind === "moderation" && x.src.id === sid && x.target_edge === c.edge);
          return r ? { type: "edge", row: r } : { type: "none" };
        }
        if (c.id === sid) return { type: "self" };
        const r = rows.find((x) => x.kind !== "moderation" && x.src.id === sid && x.tgt.id === c.id);
        if (r) return { type: "edge", row: r };
        const g = gaps.find((x) => x.src.id === sid && x.tgt.id === c.id);
        if (g) return { type: "gap", gap: g };
        return { type: "none" };
      }),
    })),
  };

  const combos = B.nodes.filter((n) => n.kind === "combination").map((n) => ({ id: n.id, label: n.label, members: (n.members || []).map((m) => ({ id: m, label: label(m) })), edges: rows.filter((r) => r.src.id === n.id) }));
  const moderations = rows.filter((r) => r.kind === "moderation");

  return {
    key: "b",
    id: "network",
    name: "Network",
    blurb: "How planting stock and site treatments act on seedlings, directly and through the conditions they change.",
    question: B.question,
    rule: B.rule,
    howBuilt: B.how_built,
    limitations: B.limitations,
    pathNote: B.limitations[0],
    nodeKinds: B.node_kinds,
    edgeKinds: B.edge_kinds,
    itemWord: ["edge", "edges"],
    counts: { nodes: B.nodes.length, items: rows.length, gaps: gaps.length, claims: Object.keys(B.evidence).length, papers: papers.length },
    glance: glance(B.edges, B.gaps),
    lensCounts: rows.reduce((m, r) => ((m[r.lens] = (m[r.lens] || 0) + 1), m), {}),
    lenses: [
      { key: "all", label: "All" },
      { key: "direct", label: "Direct" },
      { key: "cond", label: "Via conditions" },
      { key: "inter", label: "Interactions" },
    ],
    rows,
    gaps,
    combos,
    moderations,
    setAside: B.set_aside,
    papers,
    graph,
    matrix,
    label,
  };
}

export function buildModel(A, B) {
  const a = panelA(A);
  const b = panelB(B);
  return {
    question: A.question,
    panels: [a, b],
    a,
    b,
    dirs: Object.entries(DIRS).map(([key, v]) => ({ key, ...v })),
    certs: Object.entries(CERTS).map(([key, v]) => ({ key, ...v, dots: certDots(key) })),
  };
}
