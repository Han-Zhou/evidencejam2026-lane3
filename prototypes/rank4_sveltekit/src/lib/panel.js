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
