// Deterministic layered layout for the Q1 graphs (build time only).
//
// Lanes run left to right. Lane 0 can hold several labelled groups stacked.
// Links that skip a lane get a dummy waypoint in each lane they cross
// (Sugiyama style), so they pass between the nodes of that lane and never
// through a label. Nodes are ordered inside a lane by a few barycenter
// passes (ties keep first-seen order). Vertical positions come from an
// isotonic fit to the neighbours' positions. Chips sit on the curves; a
// collision pass slides each chip along its curve until it is free.

const NODE_H = 48; // base node height
const LINE_H = 17; // label line height
const CHAR_W = 7.0; // average label character width at 14.5px (DejaVu Sans is about 6.9, SF about 6.2)
const SUB_W = 6.4; // average subtitle character width at 12px
const CHIP = { w: 60, h: 22 };
const GAP_LABEL = { w: 92, h: 20 };
const NODE_GAP = 16;
const T_STEPS = Array.from({ length: 21 }, (_, i) => 0.1 + i * 0.04);

const r1 = (v) => Math.round(v * 10) / 10;
const pt = (p) => `${r1(p.x)} ${r1(p.y)}`;
export const lineWidth = (studies) => r1(Math.min(1.5 + 0.6 * studies, 7.5));

// Balanced wrap: one line if it fits, else the 2-line split with the
// shortest longest line, else greedy.
export function wrapBalanced(text, maxChars) {
  text = String(text);
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    if (a.length <= maxChars && b.length <= maxChars) {
      const score = Math.max(a.length, b.length);
      if (!best || score < best.score) best = { score, lines: [a, b] };
    }
  }
  return best ? best.lines : wrapGreedy(text, maxChars);
}

export function wrapGreedy(text, maxChars) {
  const lines = [];
  let cur = "";
  for (const w of String(text).split(/\s+/).filter(Boolean)) {
    if (cur && (cur + " " + w).length > maxChars) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Isotonic placement: keep the order, keep minimum gaps, stay as close as
// possible (weighted least squares) to each item's desired centre.
function placeLane(items, gapFn) {
  const n = items.length;
  if (!n) return;
  const off = [0];
  for (let i = 1; i < n; i++) off[i] = off[i - 1] + items[i - 1].h / 2 + items[i].h / 2 + gapFn(items[i - 1], items[i]);
  const blocks = [];
  for (let i = 0; i < n; i++) {
    const w = items[i].w8;
    blocks.push({ sum: (items[i].d - off[i]) * w, wt: w, cnt: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1];
      const a = blocks[blocks.length - 2];
      if (a.sum / a.wt <= b.sum / b.wt) break;
      blocks.pop();
      a.sum += b.sum;
      a.wt += b.wt;
      a.cnt += b.cnt;
    }
  }
  let i = 0;
  for (const b of blocks) {
    const v = b.sum / b.wt;
    for (let k = 0; k < b.cnt; k++, i++) items[i].cy = v + off[i];
  }
}

function cubicAt(s, t) {
  const m = 1 - t;
  const a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
  return { x: a * s.p0.x + b * s.p1.x + c * s.p2.x + d * s.p3.x, y: a * s.p0.y + b * s.p1.y + c * s.p2.y + d * s.p3.y };
}

function cubic(P, Q, dxMin = 30) {
  const dx = Math.max(dxMin, (Q.x - P.x) * 0.5);
  return { type: "C", p0: P, p1: { x: P.x + dx, y: P.y }, p2: { x: Q.x - dx, y: Q.y }, p3: Q };
}

function pathD(segs) {
  let d = `M${pt(segs[0].p0)}`;
  for (const s of segs) d += s.type === "C" ? `C${pt(s.p1)} ${pt(s.p2)} ${pt(s.p3)}` : `L${pt(s.p1)}`;
  return d;
}

const overlapArea = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

export function layoutGraph(spec) {
  const g = spec.geo;
  const nL = spec.lanes.length;
  const laneX = [];
  let x = g.ml;
  for (let i = 0; i < nL; i++) {
    laneX.push(x);
    x += g.nodeW + (i < nL - 1 ? (Array.isArray(g.corr) ? g.corr[i] : g.corr) : 0);
  }
  const width = x + g.mr;
  const maxChars = Math.floor((g.nodeW - 22) / CHAR_W);
  const subChars = Math.floor((g.nodeW + 10) / SUB_W);

  // ---- nodes and lanes
  const nodes = new Map();
  const lanes = spec.lanes.map(() => []);
  spec.lanes.forEach((lane, li) =>
    lane.groups.forEach((grp, gi) =>
      grp.nodes.forEach((n) => {
        const members = n.members || [];
        const lines = members.length ? [] : wrapBalanced(n.label, maxChars);
        const item = { id: n.id, label: n.label, lane: li, group: gi, lines, members, h: NODE_H, w8: 1, left: [], right: [], ports: { L: [], R: [] } };
        item.h = members.length ? 18 + members.length * 20 + (members.length - 1) * 4 : Math.max(NODE_H, 14 + lines.length * LINE_H);
        nodes.set(n.id, item);
        lanes[li].push(item);
      }),
    ),
  );
  const get = (id) => {
    const n = nodes.get(id);
    if (!n) throw new Error(`layout: unknown node ${id}`);
    return n;
  };

  // ---- links: chains through dummies, arcs inside a lane
  const links = spec.links.map((l, k) => {
    const s = get(l.s), t = get(l.t);
    const sw = l.kind === "gap" ? 6 : lineWidth(l.row.studies);
    const link = { ...l, k, sw, src: s, tgt: t };
    if (t.lane < s.lane) throw new Error(`layout: link ${l.id} points backwards`);
    if (t.lane === s.lane) {
      link.arc = true;
      link.chain = [s, t];
    } else {
      link.chain = [s];
      for (let li = s.lane + 1; li < t.lane; li++) {
        const d = { dummy: true, link, lane: li, h: sw + 4, w8: 0.5, left: [], right: [] };
        lanes[li].push(d);
        link.chain.push(d);
      }
      link.chain.push(t);
      for (let i = 0; i + 1 < link.chain.length; i++) {
        link.chain[i].right.push(link.chain[i + 1]);
        link.chain[i + 1].left.push(link.chain[i]);
      }
    }
    return link;
  });

  // ---- order: barycenter passes, keep the ordering with fewest crossings
  const rankAll = () => lanes.forEach((lane) => lane.forEach((it, i) => (it.r = (i + 0.5) / lane.length)));
  const sortLane = (li, useL, useR) => {
    const lane = lanes[li];
    if (li === 0 && spec.fixedLane0) return;
    lane.forEach((it, i) => {
      const ns = [...(useL ? it.left : []), ...(useR ? it.right : [])];
      it.key = ns.length ? mean(ns.map((n) => n.r)) : it.r;
      it.prev = i;
    });
    lane.sort((a, b) => (li === 0 ? a.group - b.group : 0) || a.key - b.key || a.prev - b.prev);
    rankAll();
  };
  const crossings = () => {
    let c = 0;
    for (let li = 0; li + 1 < nL; li++) {
      const segs = [];
      lanes[li].forEach((it, i) => it.right.forEach((o) => segs.push([i, lanes[li + 1].indexOf(o)])));
      for (let a = 0; a < segs.length; a++)
        for (let b = a + 1; b < segs.length; b++)
          if ((segs[a][0] - segs[b][0]) * (segs[a][1] - segs[b][1]) < 0) c++;
    }
    return c;
  };
  rankAll();
  for (let li = 1; li < nL; li++) sortLane(li, true, false);
  let best = { c: crossings(), order: lanes.map((l) => [...l]) };
  for (let iter = 0; iter < 4; iter++) {
    sortLane(0, false, true);
    for (let li = 1; li < nL - 1; li++) sortLane(li, true, true);
    if (nL > 1) sortLane(nL - 1, true, false);
    const c = crossings();
    if (c < best.c) best = { c, order: lanes.map((l) => [...l]) };
  }
  best.order.forEach((l, i) => (lanes[i] = l));
  rankAll();

  // ---- port lists (needed for node heights)
  const addPort = (node, side, port) => node.ports && node.ports[side].push(port);
  for (const l of links) {
    if (l.arc) {
      addPort(l.src, "R", { link: l, end: "s", sw: l.sw, other: () => l.tgt.cy });
      addPort(l.tgt, "R", { link: l, end: "t", sw: l.sw, other: () => l.src.cy });
    } else {
      addPort(l.src, "R", { link: l, end: "s", sw: l.sw, other: () => l.chain[1].cy });
      addPort(l.tgt, "L", { link: l, end: "t", sw: l.sw, other: () => l.chain[l.chain.length - 2].cy });
    }
  }
  const linkById = new Map(links.map((l) => [l.id, l]));
  const mods = (spec.moderations || []).map((m) => {
    const s = get(m.s);
    const te = linkById.get(m.te);
    if (!te) throw new Error(`layout: moderation ${m.id} targets unknown edge ${m.te}`);
    te.modTarget = true;
    const mod = { ...m, src: s, te, sw: lineWidth(m.row.studies) };
    addPort(s, "R", { link: mod, end: "s", sw: mod.sw, other: () => (te.src.cy + te.chain[1].cy) / 2 });
    return mod;
  });
  const mems = (spec.memberships || []).map((m) => {
    const mem = { ...m, src: get(m.s), tgt: get(m.t) };
    addPort(mem.src, "L", { link: mem, end: "s", sw: 3, other: () => mem.tgt.cy });
    addPort(mem.tgt, "L", { link: mem, end: "t", sw: 3, other: () => mem.src.cy });
    return mem;
  });
  const SLOT = 5;
  const portSpan = (ps) => ps.reduce((a, p) => a + p.sw + SLOT, 0) + 12;
  for (const n of nodes.values()) n.h = Math.max(n.h, portSpan(n.ports.L), portSpan(n.ports.R));

  // ---- header block: lane titles and the first group's title
  const textBlock = (title, sub, x0, y0) => {
    const subLines = sub ? wrapGreedy(sub, subChars) : [];
    return {
      title: { x: x0, y: y0 + 14, text: title },
      sub: subLines.map((t, i) => ({ x: x0, y: y0 + 31 + i * 14, text: t })),
      h: 20 + subLines.length * 14 + (subLines.length ? 4 : 0),
      box: { x: x0, y: y0, w: g.nodeW, h: 20 + subLines.length * 14 },
    };
  };
  const TOP = 8;
  const headers = [];
  spec.lanes.forEach((lane, li) => {
    if (lane.title) headers.push(textBlock(lane.title, lane.sub, laneX[li], TOP));
    else if (lane.groups[0].title) headers.push(textBlock(lane.groups[0].title, lane.groups[0].sub, laneX[li], TOP));
  });
  const top = TOP + Math.max(0, ...headers.map((h) => h.h)) + 14;

  // ---- y: lane 0 stacked by group, other lanes fitted to neighbours
  let cursor = top;
  let lastGroup = 0;
  for (const it of lanes[0]) {
    if (it.group !== lastGroup) {
      cursor += 10;
      for (let gi = lastGroup + 1; gi <= it.group; gi++) {
        const grp = spec.lanes[0].groups[gi];
        if (!grp.title || !grp.nodes.length) continue;
        const hb = textBlock(grp.title, grp.sub, laneX[0], cursor);
        headers.push(hb);
        cursor += hb.h + 8;
      }
      lastGroup = it.group;
    }
    it.cy = cursor + it.h / 2;
    cursor += it.h + NODE_GAP;
  }
  const laneGap = (li) => (g.laneGap && g.laneGap[li]) || NODE_GAP;
  const gapFn = (a, b) => (a.dummy && b.dummy ? 3 : a.dummy || b.dummy ? 9 : laneGap(a.lane));
  const fit = (li, useL, useR) => {
    for (const it of lanes[li]) {
      const ns = [...(useL ? it.left : []), ...(useR ? it.right : [])].filter((n) => n.cy != null);
      it.d = ns.length ? mean(ns.map((n) => n.cy)) : it.cy != null ? it.cy : top;
      if (!ns.length) it.w8 = 0.05;
    }
    placeLane(lanes[li], gapFn);
    const minTop = Math.min(...lanes[li].map((it) => it.cy - it.h / 2));
    if (minTop < top) lanes[li].forEach((it) => (it.cy += top - minTop));
  };
  for (let li = 1; li < nL; li++) fit(li, true, false);
  for (let iter = 0; iter < 3; iter++) {
    for (let li = 1; li < nL - 1; li++) fit(li, true, true);
    if (nL > 1) fit(nL - 1, true, false);
  }
  // Stretch lanes 1.. so they use most of lane 0's height: converging
  // edges then have room for their chips. Scaling centres keeps the order
  // and only widens gaps.
  const span = (lane) => [Math.min(...lane.map((it) => it.cy - it.h / 2)), Math.max(...lane.map((it) => it.cy + it.h / 2))];
  const [top0, bot0] = span(lanes[0]);
  for (let li = 1; li < nL; li++) {
    const lane = lanes[li];
    if (lane.length < 2) continue;
    const [a, b] = span(lane);
    const want = (bot0 - top0) * (g.stretch || 0.8);
    if (b - a >= want) continue;
    const first = lane[0], last = lane[lane.length - 1];
    const k = (want - first.h / 2 - last.h / 2) / (last.cy - first.cy);
    const mid = (first.cy + last.cy) / 2;
    const newMid = Math.min(Math.max(mid, top0 + want / 2), bot0 - want / 2);
    for (const it of lane) it.cy = newMid + (it.cy - mid) * k;
  }
  for (const lane of lanes) for (const it of lane) it.y = it.cy - it.h / 2;
  const height = Math.ceil(Math.max(...lanes.flat().map((it) => it.y + it.h), ...headers.map((h) => h.box.y + h.box.h)) + 20);

  // ---- port positions
  for (const n of nodes.values()) {
    n.x = laneX[n.lane];
    n.w = g.nodeW;
    for (const side of ["L", "R"]) {
      const ps = n.ports[side];
      ps.forEach((p, i) => ((p.key = p.other()), (p.i = i)));
      ps.sort((a, b) => a.key - b.key || a.i - b.i);
      let y = n.cy - (portSpan(ps) - 12) / 2;
      for (const p of ps) {
        p.y = y + (p.sw + SLOT) / 2;
        y += p.sw + SLOT;
        p.link.ports = p.link.ports || {};
        p.link.ports[p.end] = { x: side === "L" ? n.x : n.x + n.w, y: p.y };
      }
    }
  }

  // ---- routes
  const arrowLen = (sw) => 7 + sw * 0.7;
  for (const l of links) {
    const S = l.ports.s;
    const T = l.ports.t;
    const L = l.kind === "gap" ? 0 : arrowLen(l.sw);
    const hw = (l.sw + 7) / 2;
    if (l.arc) {
      const xr = S.x;
      const k = 34 + 0.15 * Math.abs(T.y - S.y);
      const end = { x: xr + (L ? L - 0.5 : 2), y: T.y };
      l.segs = [{ type: "C", p0: S, p1: { x: xr + k, y: S.y }, p2: { x: xr + k, y: T.y }, p3: end }];
      if (L) l.arrow = [{ x: xr + 1, y: T.y }, { x: xr + 1 + L, y: T.y - hw }, { x: xr + 1 + L, y: T.y + hw }];
    } else {
      const segs = [];
      let P = S;
      for (const d of l.chain.slice(1, -1)) {
        const A = { x: laneX[d.lane], y: d.cy };
        const B = { x: laneX[d.lane] + g.nodeW, y: d.cy };
        segs.push(cubic(P, A), { type: "L", p0: A, p1: B });
        P = B;
      }
      const end = { x: T.x - (L ? L - 0.5 : 2), y: T.y };
      segs.push(cubic(P, end));
      l.segs = segs;
      if (L) l.arrow = [{ x: T.x - 1, y: T.y }, { x: T.x - 1 - L, y: T.y - hw }, { x: T.x - 1 - L, y: T.y + hw }];
    }
    l.d = pathD(l.segs);
  }

  // ---- chips: collision pass along each curve
  // Every candidate point on the allowed curve segments gets a cost:
  // overlap with a node, a header or a placed chip is (almost) forbidden,
  // being close to another chip costs a little, and so does being far from
  // the middle of the curve. The cheapest candidate wins. Deterministic.
  const obstacles = [];
  // pad the left side more: arrowheads arrive there
  for (const n of nodes.values()) obstacles.push({ x: n.x - 18, y: n.y - 5, w: n.w + 26, h: n.h + 10 });
  for (const h of headers) obstacles.push({ x: h.box.x, y: h.box.y, w: h.box.w, h: h.box.h });
  const placed = [];
  const rectGap = (a, b) => Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
  const place = (segs, size, segOrder) => {
    let bestC = null;
    for (const si of segOrder)
      for (const t of T_STEPS) {
        const p = cubicAt(segs[si], t);
        const box = { x: p.x - size.w / 2, y: p.y - size.h / 2, w: size.w, h: size.h };
        if (box.x < 2 || box.x + box.w > width - 2 || box.y < 2 || box.y + box.h > height - 2) continue;
        let hard = 0;
        let soft = Math.abs(t - 0.5) * 30;
        for (const o of obstacles) hard += overlapArea(box, o);
        for (const o of placed) {
          hard += overlapArea(box, o);
          const gap = rectGap(box, o);
          if (gap < 14) soft += (14 - gap) * (14 - gap) * 0.6;
        }
        const cost = hard * 1000 + soft;
        if (!bestC || cost < bestC.cost) bestC = { cost, hard, p, box };
      }
    if (!bestC) {
      const p = cubicAt(segs[segOrder[0]], 0.5);
      bestC = { hard: 1, p, box: { x: p.x - size.w / 2, y: p.y - size.h / 2, w: size.w, h: size.h } };
    }
    placed.push(bestC.box);
    return { x: r1(bestC.p.x), y: r1(bestC.p.y), w: size.w, h: size.h, ...(bestC.hard ? { overlap: true } : {}) };
  };
  const cubicIdx = (segs) => segs.map((s, i) => (s.type === "C" ? i : -1)).filter((i) => i >= 0);
  const order = [...links.filter((l) => l.modTarget), ...links.filter((l) => !l.modTarget && l.kind !== "gap"), ...links.filter((l) => l.kind === "gap")];
  for (const l of order) {
    const cs = cubicIdx(l.segs);
    const segOrder = l.modTarget ? [cs[0]] : cs;
    l.chip = place(l.segs, l.kind === "gap" ? GAP_LABEL : CHIP, segOrder);
  }

  // ---- moderation: dotted curve from the source to the target edge's chip
  for (const m of mods) {
    const S = m.ports.s;
    const c = m.te.chip;
    const fromTop = S.y <= c.y;
    const tipY = fromTop ? c.y - c.h / 2 : c.y + c.h / 2;
    const E = { x: c.x, y: fromTop ? tipY - 6 : tipY + 6 };
    const dy = Math.max(24, Math.abs(E.y - S.y) * 0.6) * (fromTop ? -1 : 1);
    m.segs = [{ type: "C", p0: S, p1: { x: S.x + Math.max(40, (E.x - S.x) * 0.55), y: S.y }, p2: { x: E.x, y: E.y + dy }, p3: E }];
    m.d = pathD(m.segs);
    m.diamond = [{ x: c.x, y: tipY - 6 }, { x: c.x + 6, y: tipY }, { x: c.x, y: tipY + 6 }, { x: c.x - 6, y: tipY }];
    m.chip = place(m.segs, CHIP, [0]);
  }

  // ---- membership connectors: nested arcs on the left of lane 0
  const memDist = mems.map((m) => Math.abs(m.ports.s.y - m.ports.t.y));
  const memRank = memDist.map((d) => memDist.filter((o) => o < d).length);
  mems.forEach((m, i) => {
    const P = m.ports.s, Q = m.ports.t;
    const k = 14 + 12 * memRank[i];
    m.d = `M${pt(P)}C${pt({ x: P.x - k, y: P.y })} ${pt({ x: Q.x - k, y: Q.y })} ${pt(Q)}`;
  });

  const poly = (ps) => ps.map(pt).join(" ");
  const nodeOut = [...lanes.flat()].filter((it) => !it.dummy).map((n) => {
    const lineTop = n.cy - (n.lines.length * LINE_H) / 2 + 12;
    const chipTop = n.cy - (n.members.length * 24 - 4) / 2;
    return {
      id: n.id,
      label: n.label,
      lane: n.lane,
      group: n.group,
      x: r1(n.x),
      y: r1(n.y),
      w: n.w,
      h: r1(n.h),
      lines: n.lines.map((t, i) => ({ x: r1(n.x + 12), y: r1(lineTop + i * LINE_H), text: t })),
      chips: n.members.map((m, i) => ({ x: r1(n.x + 8), y: r1(chipTop + i * 24), w: n.w - 16, h: 20, tx: r1(n.x + 16), ty: r1(chipTop + i * 24 + 14) })),
      inN: links.filter((l) => l.tgt === n && l.kind !== "gap").length,
      outN: links.filter((l) => l.src === n && l.kind !== "gap").length + mods.filter((m) => m.src === n).length,
    };
  });

  return {
    width,
    height,
    lanes: laneX.map((lx) => ({ x: lx, w: g.nodeW })),
    headers: headers.map((h) => ({ title: h.title, sub: h.sub })),
    nodes: nodeOut,
    edges: links.filter((l) => l.kind !== "gap").map((l) => ({ id: l.id, s: l.src.id, t: l.tgt.id, d: l.d, sw: l.sw, arrow: poly(l.arrow), chip: l.chip, row: l.row, arc: !!l.arc })),
    gaps: links.filter((l) => l.kind === "gap").map((l) => ({ id: l.id, s: l.src.id, t: l.tgt.id, d: l.d, label: l.chip, gap: l.gap })),
    moderations: mods.map((m) => ({ id: m.id, s: m.src.id, te: m.te.id, d: m.d, sw: m.sw, diamond: poly(m.diamond), chip: m.chip, row: m.row })),
    memberships: mems.map((m) => ({ s: m.src.id, t: m.tgt.id, d: m.d })),
    crossings: best.c,
    chipOverlaps: [...links, ...mods].filter((l) => l.chip && l.chip.overlap).map((l) => l.id),
  };
}
