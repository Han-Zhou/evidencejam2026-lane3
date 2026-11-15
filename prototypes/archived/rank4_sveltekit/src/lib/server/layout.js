// Deterministic layered layout (SPEC 3.1). Runs at build time only.
// Lanes left to right; groups stacked inside lane 0; long edges get a dummy
// waypoint in the middle lane so they pass between condition nodes, never
// through their labels. Order inside lanes: barycenter sweeps, ties by
// first-seen order in the JSON. Vertical positions: isotonic regression (PAV)
// towards the mean of each item's neighbours, with minimum gaps.
// The same input always gives the same picture: no randomness, no forces.

import { line, curveBumpX } from 'd3-shape';

export const NODE_W = 192;
export const CHIP_W = 60;
export const CHIP_H = 22;
export const GAP_LABEL_W = 92;
const LINE_H = 17;
const PAD_Y = 12;
const ARROW = 10;
const MARGIN_L = 50;
const MARGIN_R = 22;
const MARGIN_T = 6;
const MARGIN_B = 20;
const MOD_SPACE = 42; // extra room above a chip that a moderation edge points at

const bump = line().curve(curveBumpX);
const r = (v) => Math.round(v * 10) / 10;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

/** rough width of a string in px for the system sans stack */
function textWidth(s, size) {
	let w = 0;
	for (const ch of s) {
		if ("il.,:;'|!()[]".includes(ch)) w += 0.27;
		else if ('fjrt '.includes(ch)) w += 0.33;
		else if ('mwMW'.includes(ch)) w += 0.84;
		else if (ch >= 'A' && ch <= 'Z') w += 0.66;
		else if (ch === '&') w += 0.68;
		else w += 0.55;
	}
	return w * size;
}

export function wrap(text, maxW, size) {
	const words = String(text).split(/\s+/).filter(Boolean);
	const lines = [];
	let cur = '';
	for (const w of words) {
		const t = cur ? `${cur} ${w}` : w;
		if (!cur || textWidth(t, size) <= maxW) cur = t;
		else {
			lines.push(cur);
			cur = w;
		}
	}
	if (cur) lines.push(cur);
	return lines;
}

/** isotonic regression, non-decreasing, unit weights */
function pav(y) {
	const blocks = [];
	for (const v of y) {
		blocks.push({ sum: v, n: 1 });
		while (blocks.length > 1) {
			const b = blocks[blocks.length - 1];
			const a = blocks[blocks.length - 2];
			if (a.sum / a.n <= b.sum / b.n) break;
			blocks.pop();
			a.sum += b.sum;
			a.n += b.n;
		}
	}
	const out = [];
	for (const b of blocks) for (let k = 0; k < b.n; k++) out.push(b.sum / b.n);
	return out;
}

function sep(a, b) {
	let s;
	if (a.type === 'node' && b.type === 'node') s = 18;
	else if (a.type === 'node' || b.type === 'node') s = 12;
	else s = 8;
	return s + (b.extraTop || 0);
}

/** place items of one column in order, as close to `desired` centres as the gaps allow */
function placeColumn(items, desired, top) {
	const G = [0];
	for (let i = 1; i < items.length; i++)
		G[i] = G[i - 1] + items[i - 1].h / 2 + sep(items[i - 1], items[i]) + items[i].h / 2;
	const z = pav(desired.map((d, i) => d - G[i]));
	let ys = z.map((v, i) => v + G[i]);
	const minTop = Math.min(...ys.map((y, i) => y - items[i].h / 2 - (items[i].extraTop || 0)));
	if (minTop < top) ys = ys.map((y) => y + (top - minTop));
	return ys;
}

// ---- cubic sampling (matches d3 curveBumpX) for chip placement ----
function cubicPts(p0, c1, c2, p3, n = 24) {
	const out = [];
	for (let i = 0; i <= n; i++) {
		const t = i / n;
		const u = 1 - t;
		out.push([
			u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
			u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]
		]);
	}
	return out;
}
function bumpSamples(pts) {
	const out = [];
	for (let i = 0; i + 1 < pts.length; i++) {
		const p = pts[i];
		const q = pts[i + 1];
		const mx = (p[0] + q[0]) / 2;
		const s = cubicPts(p, [mx, p[1]], [mx, q[1]], q);
		out.push(...(i ? s.slice(1) : s));
	}
	return out;
}
function pointAt(samples, f) {
	const L = [0];
	for (let i = 1; i < samples.length; i++)
		L[i] = L[i - 1] + Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]);
	const target = L[L.length - 1] * f;
	for (let i = 1; i < samples.length; i++) {
		if (L[i] >= target) {
			const t = (target - L[i - 1]) / (L[i] - L[i - 1] || 1);
			return [
				samples[i - 1][0] + t * (samples[i][0] - samples[i - 1][0]),
				samples[i - 1][1] + t * (samples[i][1] - samples[i - 1][1])
			];
		}
	}
	return samples[samples.length - 1];
}
function overlap(a, b) {
	const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
	const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
	return w > 0 && h > 0 ? w * h : 0;
}
const rectAt = (x, y, w, h, pad = 0) => ({
	x1: x - w / 2 - pad,
	x2: x + w / 2 + pad,
	y1: y - h / 2 - pad,
	y2: y + h / 2 + pad
});
const FRACTIONS = [0.5, 0.43, 0.57, 0.36, 0.64, 0.3, 0.7, 0.24, 0.76, 0.19, 0.81, 0.14, 0.86];

/**
 * @param {{
 *   lanes: {groups: {key: string, title: string, subtitle?: string, nodeIds: string[]}[]}[],
 *   nodes: {id: string, label: string, kind?: string, members?: string[]}[],
 *   edges: {id: string, kind: string, source: string, target: string|null, targetEdge?: string, studies: number}[],
 *   gaps: {id: string, source: string, target: string}[],
 *   laneGap: number
 * }} g
 */
export function layoutGraph(g) {
	const L = g.lanes.length;
	// laneGap: one number, or one gap per pair of lanes (busier gaps get more room for chips)
	const gaps = Array.isArray(g.laneGap) ? g.laneGap : g.lanes.map(() => g.laneGap);
	const laneX = [];
	g.lanes.forEach((_, i) => laneX.push(i ? laneX[i - 1] + NODE_W + gaps[i - 1] : MARGIN_L));
	const firstSeen = new Map(g.nodes.map((n, i) => [n.id, i]));

	// ---- node boxes ----
	const nodes = new Map();
	g.lanes.forEach((lane, li) =>
		lane.groups.forEach((grp, gi) =>
			grp.nodeIds.forEach((id) => {
				const n = g.nodes.find((x) => x.id === id);
				let lines;
				let h;
				if (n.members) {
					lines = [];
					h = 34 + n.members.length * 26;
				} else {
					lines = wrap(n.label, NODE_W - 30, 14.5);
					h = PAD_Y * 2 + lines.length * LINE_H;
				}
				nodes.set(id, { id, lane: li, group: gi, lines, w: NODE_W, h, x: laneX[li], y: 0 });
			})
		)
	);

	// ---- headers ----
	const HEAD_SUB = 11.5;
	const headLines = (grp) => (grp.subtitle ? wrap(grp.subtitle, NODE_W + 24, HEAD_SUB) : []);
	const topHeadH = Math.max(...g.lanes.map((l) => 22 + headLines(l.groups[0]).length * 14)) + 14;
	const top = MARGIN_T + topHeadH;
	const headers = g.lanes.map((lane, li) => ({
		key: lane.groups[0].key,
		x: laneX[li],
		y: MARGIN_T,
		title: lane.groups[0].title,
		sub: headLines(lane.groups[0])
	}));

	// ---- layer items ----
	const layers = g.lanes.map(() => []);
	g.lanes.forEach((lane, li) =>
		lane.groups.forEach((grp, gi) =>
			grp.nodeIds.forEach((id) =>
				layers[li].push({
					key: `n:${id}`,
					type: 'node',
					id,
					layer: li,
					group: gi,
					h: nodes.get(id).h,
					fs: firstSeen.get(id)
				})
			)
		)
	);
	const moderated = new Set(g.edges.filter((e) => e.kind === 'moderation').map((e) => e.targetEdge));
	const routes = new Map(); // id -> item keys along the route
	const itemByKey = new Map();
	const addRoute = (id, src, tgt, isGap, idx) => {
		const ls = nodes.get(src).lane;
		const lt = nodes.get(tgt).lane;
		const keys = [`n:${src}`];
		for (let l = ls + 1; l < lt; l++) {
			const key = `d:${id}:${l}`;
			layers[l].push({
				key,
				type: 'dummy',
				id,
				gap: isGap,
				layer: l,
				group: 0,
				h: CHIP_H,
				extraTop: moderated.has(id) ? MOD_SPACE : 0,
				fs: 1000 + idx
			});
			keys.push(key);
		}
		keys.push(`n:${tgt}`);
		routes.set(id, keys);
	};
	g.edges.forEach((e, i) => e.kind !== 'moderation' && addRoute(e.id, e.source, e.target, false, i));
	g.gaps.forEach((e, i) => addRoute(e.id, e.source, e.target, true, 500 + i));
	layers.flat().forEach((it) => itemByKey.set(it.key, it));

	const up = new Map();
	const down = new Map();
	const push = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);
	const link = (a, b) => {
		push(down, a, b);
		push(up, b, a);
	};
	for (const keys of routes.values())
		for (let i = 0; i + 1 < keys.length; i++) {
			const a = itemByKey.get(keys[i]);
			const b = itemByKey.get(keys[i + 1]);
			if (a.layer + 1 === b.layer) link(a.key, b.key);
		}
	for (const e of g.edges)
		if (e.kind === 'moderation') {
			const keys = routes.get(e.targetEdge) ?? [];
			const mid = keys.find((k) => k.startsWith('d:')) ?? keys[keys.length - 1];
			const a = itemByKey.get(`n:${e.source}`);
			const b = mid && itemByKey.get(mid);
			if (b && a.layer + 1 === b.layer) link(a.key, b.key);
		}

	// ---- crossing reduction ----
	const pos = new Map();
	const index = () => layers.forEach((Ly) => Ly.forEach((it, i) => pos.set(it.key, i)));
	const crossings = () => {
		let c = 0;
		for (let l = 0; l + 1 < L; l++) {
			const segs = [];
			for (const it of layers[l]) for (const k of down.get(it.key) ?? []) segs.push([pos.get(it.key), pos.get(k)]);
			for (let i = 0; i < segs.length; i++)
				for (let j = i + 1; j < segs.length; j++)
					if ((segs[i][0] - segs[j][0]) * (segs[i][1] - segs[j][1]) < 0) c++;
		}
		return c;
	};
	const reorder = (l, nb) => {
		const withB = layers[l].map((it) => {
			const ns = nb.get(it.key) ?? [];
			return { it, b: ns.length ? mean(ns.map((k) => pos.get(k))) : pos.get(it.key) };
		});
		withB.sort((a, b) => a.it.group - b.it.group || a.b - b.b || a.it.fs - b.it.fs);
		layers[l] = withB.map((x) => x.it);
	};
	index();
	let best = layers.map((Ly) => Ly.slice());
	let bestC = crossings();
	for (let pass = 0; pass < 4; pass++) {
		for (let l = 1; l < L; l++) {
			reorder(l, up);
			index();
		}
		for (let l = L - 2; l >= 0; l--) {
			reorder(l, down);
			index();
		}
		const c = crossings();
		if (c < bestC) {
			bestC = c;
			best = layers.map((Ly) => Ly.slice());
		}
	}
	best.forEach((Ly, l) => (layers[l] = Ly));
	index();

	// ---- vertical positions ----
	const yOf = new Map(); // item key -> centre y
	const groupHeads = [];
	{
		// lane 0: groups stacked, compact, inline headers for groups after the first
		let y = top;
		g.lanes[0].groups.forEach((grp, gi) => {
			if (gi > 0) {
				const sub = headLines(grp);
				y += 8;
				groupHeads.push({ key: grp.key, x: laneX[0], y, title: grp.title, sub });
				y += 22 + sub.length * 14 + 8;
			}
			for (const it of layers[0].filter((x) => x.group === gi)) {
				yOf.set(it.key, y + it.h / 2);
				y += it.h + 18;
			}
		});
	}
	const placeLayer = (l, useDown) => {
		const items = layers[l];
		const desired = items.map((it, i) => {
			const ns = [...(up.get(it.key) ?? []), ...(useDown ? (down.get(it.key) ?? []) : [])].filter((k) => yOf.has(k));
			if (ns.length) return mean(ns.map((k) => yOf.get(k)));
			return yOf.get(it.key) ?? top + i * 40;
		});
		placeColumn(items, desired, top).forEach((y, i) => yOf.set(items[i].key, y));
	};
	for (let l = 1; l < L; l++) placeLayer(l, false);
	for (let round = 0; round < 3; round++) for (let l = 1; l < L; l++) placeLayer(l, l < L - 1);

	for (const Ly of layers)
		for (const it of Ly) if (it.type === 'node') nodes.get(it.id).y = yOf.get(it.key) - it.h / 2;

	const cy = (id) => nodes.get(id).y + nodes.get(id).h / 2;
	const right = (id) => nodes.get(id).x + NODE_W;
	const left = (id) => nodes.get(id).x;

	// ---- ports ----
	// each route end gets a port on the node side; ports are spread and sorted by
	// the y of the neighbouring waypoint so lines do not cross at the node.
	const sides = new Map(); // `${node}|R` -> [{ref, other}]
	const addPort = (node, side, ref, other) => push(sides, `${node}|${side}`, { ref, other });
	const waypointsY = (id) => (routes.get(id) ?? []).slice(1, -1).map((k) => yOf.get(k));
	const allRoutes = [
		...g.edges.filter((e) => e.kind !== 'moderation').map((e) => ({ ...e, isGap: false })),
		...g.gaps.map((e) => ({ ...e, isGap: true }))
	];
	for (const e of allRoutes) {
		const wy = waypointsY(e.id);
		const sameLane = nodes.get(e.source).lane === nodes.get(e.target).lane;
		addPort(e.source, 'R', `${e.id}|s`, wy.length ? wy[0] : cy(e.target));
		addPort(e.target, sameLane ? 'R' : 'L', `${e.id}|t`, wy.length ? wy[wy.length - 1] : cy(e.source));
	}
	for (const e of g.edges)
		if (e.kind === 'moderation') {
			const wy = waypointsY(e.targetEdge);
			addPort(e.source, 'R', `${e.id}|s`, wy.length ? wy[0] - 20 : cy(e.source));
		}
	const portY = new Map();
	for (const [key, ports] of sides) {
		const id = key.split('|')[0];
		const n = nodes.get(id);
		ports.sort((a, b) => a.other - b.other || (a.ref < b.ref ? -1 : 1));
		const k = ports.length;
		const spacing = k > 1 ? Math.min(10, (n.h - 16) / (k - 1)) : 0;
		ports.forEach((p, i) => portY.set(p.ref, cy(id) + (i - (k - 1) / 2) * spacing));
	}

	// ---- paths ----
	const out = { edges: {}, gaps: {}, members: [] };
	const samples = new Map();
	for (const e of allRoutes) {
		const y0 = portY.get(`${e.id}|s`);
		const y1 = portY.get(`${e.id}|t`);
		const sameLane = nodes.get(e.source).lane === nodes.get(e.target).lane;
		let d;
		let s;
		if (sameLane) {
			const x = right(e.source);
			const B = 40 + 0.12 * Math.abs(y1 - y0);
			const p0 = [x, y0];
			const c1 = [x + B, y0];
			const c2 = [x + B, y1];
			const p3 = [x + ARROW, y1];
			d = `M${r(p0[0])},${r(p0[1])}C${r(c1[0])},${r(c1[1])},${r(c2[0])},${r(c2[1])},${r(p3[0])},${r(p3[1])}`;
			s = cubicPts(p0, c1, c2, p3, 40);
		} else {
			const pts = [[right(e.source), y0]];
			for (const k of (routes.get(e.id) ?? []).slice(1, -1)) {
				const it = itemByKey.get(k);
				pts.push([laneX[it.layer] - 2, yOf.get(k)], [laneX[it.layer] + NODE_W + 2, yOf.get(k)]);
			}
			pts.push([left(e.target) - (e.isGap ? 2 : ARROW), y1]);
			const rp = pts.map(([x, y]) => [r(x), r(y)]);
			d = bump(rp);
			s = bumpSamples(rp);
		}
		samples.set(e.id, s);
		(e.isGap ? out.gaps : out.edges)[e.id] = { d };
	}

	// ---- chips and gap labels: no overlaps ----
	const obstacles = [];
	for (const n of nodes.values()) obstacles.push({ x1: n.x - 6, x2: n.x + NODE_W + 6, y1: n.y - 6, y2: n.y + n.h + 6 });
	for (const h of [...headers, ...groupHeads])
		obstacles.push({ x1: h.x, x2: h.x + NODE_W + 24, y1: h.y, y2: h.y + 18 + h.sub.length * 14 });
	const place = (id, w, fractions = FRACTIONS) => {
		const s = samples.get(id);
		let bestP = null;
		let bestO = Infinity;
		for (const f of fractions) {
			const [x, y] = pointAt(s, f);
			const rc = rectAt(x, y, w, CHIP_H, 5);
			const o = obstacles.reduce((sum, ob) => sum + overlap(rc, ob), 0);
			if (o < bestO) {
				bestO = o;
				bestP = [x, y];
				if (o === 0) break;
			}
		}
		obstacles.push(rectAt(bestP[0], bestP[1], w, CHIP_H, 1));
		return { x: r(bestP[0]), y: r(bestP[1]) };
	};
	const fixed = (id, w) => {
		const k = (routes.get(id) ?? []).find((x) => x.startsWith('d:'));
		if (!k) return null;
		const it = itemByKey.get(k);
		const p = { x: r(laneX[it.layer] + NODE_W / 2), y: r(yOf.get(k)) };
		obstacles.push(rectAt(p.x, p.y, w, CHIP_H, 1));
		return p;
	};
	// fixed spots first (waypoints in the middle lane), then the rest by studies (desc)
	for (const e of g.gaps) out.gaps[e.id].label = fixed(e.id, GAP_LABEL_W);
	for (const e of g.edges) if (e.kind !== 'moderation') out.edges[e.id].chip = fixed(e.id, CHIP_W);
	for (const e of g.gaps) if (!out.gaps[e.id].label) out.gaps[e.id].label = place(e.id, GAP_LABEL_W);
	const free = g.edges
		.map((e, i) => ({ e, i }))
		.filter(({ e }) => e.kind !== 'moderation' && !out.edges[e.id].chip)
		.sort((a, b) => b.e.studies - a.e.studies || a.i - b.i);
	for (const { e } of free) out.edges[e.id].chip = place(e.id, CHIP_W);

	// ---- moderation edges: dotted curve to the target edge's chip, diamond on the chip ----
	for (const e of g.edges) {
		if (e.kind !== 'moderation') continue;
		const tc = out.edges[e.targetEdge]?.chip;
		if (!tc) continue;
		const p0 = [right(e.source), portY.get(`${e.id}|s`)];
		const E = [tc.x - CHIP_W / 2 + 12, tc.y - CHIP_H / 2];
		const end = [E[0], E[1] - 6];
		const c1 = [p0[0] + 0.55 * (end[0] - p0[0]), p0[1]];
		const c2 = [end[0] - 6, end[1] - 44];
		const d = `M${r(p0[0])},${r(p0[1])}C${r(c1[0])},${r(c1[1])},${r(c2[0])},${r(c2[1])},${r(end[0])},${r(end[1])}`;
		samples.set(e.id, cubicPts(p0, c1, c2, end, 40));
		out.edges[e.id] = {
			d,
			diamond: { x: r(E[0]), y: r(E[1]) },
			chip: null
		};
		out.edges[e.id].chip = place(e.id, CHIP_W, [0.4, 0.33, 0.47, 0.27, 0.54, 0.22, 0.6, 0.66]);
	}

	// ---- membership connectors (combination): arcs on the lane's left side ----
	for (const n of g.nodes) {
		if (!n.members) continue;
		for (const m of n.members) {
			if (!nodes.has(m)) continue;
			const x = left(n.id);
			const y0 = cy(m);
			const y1 = cy(n.id);
			const B = 22 + 0.05 * Math.abs(y1 - y0);
			out.members.push({
				from: m,
				to: n.id,
				d: `M${r(left(m))},${r(y0)}C${r(left(m) - B)},${r(y0)},${r(x - B)},${r(y1)},${r(x)},${r(y1)}`
			});
		}
	}

	let maxY = 0;
	for (const n of nodes.values()) maxY = Math.max(maxY, n.y + n.h);
	for (const k of yOf.keys()) maxY = Math.max(maxY, yOf.get(k) + CHIP_H);
	const width = laneX[L - 1] + NODE_W + MARGIN_R;
	const height = maxY + MARGIN_B;

	return {
		width: Math.ceil(width),
		height: Math.ceil(height),
		nodes: Object.fromEntries(
			[...nodes.values()].map((n) => [n.id, { x: r(n.x), y: r(n.y), w: n.w, h: r(n.h), lines: n.lines }])
		),
		headers: [...headers, ...groupHeads],
		edges: out.edges,
		gaps: out.gaps,
		members: out.members,
		crossings: bestC
	};
}
