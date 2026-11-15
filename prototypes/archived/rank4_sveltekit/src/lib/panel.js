// Lookups over one panel model. Pure functions; safe on server and client.
import { edgeSentence } from './format.js';

export function makeIndex(model) {
	const nodeById = new Map(model.nodes.map((n) => [n.id, n]));
	const edgeById = new Map(model.edges.map((e) => [e.id, e]));
	const gapById = new Map(model.gaps.map((g) => [g.id, g]));
	const paperById = new Map(model.papers.map((p) => [p.id, p]));
	const label = (id) => nodeById.get(id)?.label ?? id;
	const fromLabel = (e) => label(e.source);
	const toLabel = (e) => {
		if (e.kind === 'moderation') {
			const t = edgeById.get(e.target_edge);
			return t ? `${label(t.source)} → ${label(t.target)}` : String(e.target_edge);
		}
		return label(e.target);
	};
	const title = (e) =>
		e.kind === 'moderation' ? `${fromLabel(e)} → effect of ${toLabel(e)}` : `${fromLabel(e)} → ${toLabel(e)}`;
	const aria = (e) =>
		edgeSentence(e, fromLabel(e), e.kind === 'moderation' ? `the effect of ${toLabel(e)}` : toLabel(e));
	const outEdges = (id) => model.edges.filter((e) => e.source === id);
	const inEdges = (id) => model.edges.filter((e) => e.target === id);
	const gapsOf = (id) => model.gaps.filter((g) => g.source === id || g.target === id);
	const kindText = (n) => {
		if (!n) return '';
		if (model.node_kinds && n.kind) return model.node_kinds[n.kind] ?? n.kind;
		return n.shape === 'outcome' ? 'Outcome' : 'Factor';
	};
	const resolve = (item) => {
		if (!item) return null;
		if (item.type === 'edge') return edgeById.get(item.id) ?? null;
		if (item.type === 'node') return nodeById.get(item.id) ?? null;
		if (item.type === 'gap') return gapById.get(item.id) ?? null;
		if (item.type === 'paper') return paperById.get(item.id) ?? null;
		if (item.type === 'claim') return { id: item.id };
		return null;
	};
	return {
		nodeById,
		edgeById,
		gapById,
		paperById,
		label,
		fromLabel,
		toLabel,
		title,
		aria,
		outEdges,
		inEdges,
		gapsOf,
		kindText,
		resolve
	};
}

/**
 * What stays bright when the reader selects an item in the graph (SPEC 3.6.1).
 * Returns { edges: Map(edge id -> 1 | 2), nodes, gaps, members } where 1 = one step
 * from the selected node (or the selected edge itself) and 2 = further away.
 * Only membership is computed: nothing is added or multiplied along a path.
 */
export function emphasis(model, ix, item) {
	const edges = new Map();
	const nodes = new Set();
	const gaps = new Set();
	const members = new Set();
	const put = (e, hop) => {
		if (!e) return;
		if (!edges.has(e.id) || edges.get(e.id) > hop) edges.set(e.id, hop);
		nodes.add(e.source);
		if (e.target) nodes.add(e.target);
	};
	const { type, id } = item;
	if (type === 'node') {
		nodes.add(id);
		const effect = model.edges.filter((e) => e.kind !== 'moderation');
		// active pathways: every edge reachable downstream from N, and every edge
		// that leads upstream into N (breadth first, so each edge gets its least hop)
		for (const [from, to] of [
			['source', 'target'],
			['target', 'source']
		]) {
			let frontier = new Set([id]);
			const seen = new Set([id]);
			for (let hop = 1; frontier.size; hop++) {
				const next = new Set();
				for (const e of effect) {
					if (!frontier.has(e[from]) || edges.has(e.id)) continue;
					put(e, hop > 1 ? 2 : 1);
					const n = e[to];
					if (n && !seen.has(n)) {
						seen.add(n);
						next.add(n);
					}
				}
				frontier = next;
			}
		}
		// moderation: from N (then also its target edge), or onto an active edge
		for (const e of model.edges) {
			if (e.kind !== 'moderation') continue;
			if (e.source === id) {
				put(e, 1);
				if (!edges.has(e.target_edge)) put(ix.edgeById.get(e.target_edge), 2);
			} else if (edges.has(e.target_edge)) put(e, 2);
		}
		for (const g of model.gaps)
			if (g.source === id || g.target === id) {
				gaps.add(g.id);
				nodes.add(g.source);
				nodes.add(g.target);
			}
		// combination: N is a member (its connector + the combination node) or N is the combination
		for (const m of model.members)
			if (m.from === id || m.to === id) {
				members.add(`${m.from}|${m.to}`);
				nodes.add(m.from);
				nodes.add(m.to);
			}
	} else if (type === 'edge') {
		const e = ix.edgeById.get(id);
		put(e, 1);
		// a moderation edge: its source, its diamond and its target edge
		if (e?.target_edge) put(ix.edgeById.get(e.target_edge), 1);
		// moderation edges whose diamond sits on this edge's chip
		for (const m of model.edges) if (m.target_edge === id) put(m, 1);
		if (e && ix.nodeById.get(e.source)?.members)
			for (const m of model.members)
				if (m.to === e.source) {
					members.add(`${m.from}|${m.to}`);
					nodes.add(m.from);
				}
	} else if (type === 'gap') {
		const g = ix.gapById.get(id);
		if (g) {
			gaps.add(id);
			nodes.add(g.source);
			nodes.add(g.target);
		}
	} else return null;
	return { edges, nodes, gaps, members };
}

/** claim ids of an edge grouped by paper, papers with most claims first */
export function groupByPaper(ids, claims) {
	const groups = new Map();
	for (const cid of ids ?? []) {
		const c = claims?.[cid];
		if (!c) continue;
		const g = groups.get(c.document_id) ?? groups.set(c.document_id, []).get(c.document_id);
		g.push(cid);
	}
	return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}
