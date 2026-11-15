// Build-time view models. Reads the two Q1 answer files and returns:
//  - buildModel(): the slim per-panel model that the page renders and hydrates
//    (pooled fields, geometry, paper list; no claim quotes except the 5
//    Panel A interaction claims);
//  - evidenceFile(key): the claims of one panel (with quotes), written once as
//    data/<key>.json and fetched by the client only when needed.
// Every direction, certainty, rationale, count, label and quote is copied
// verbatim. Only counting, sorting and grouping happen here (SPEC 1.2).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { layoutGraph } from './layout.js';

const FILES = { findings: 'q1_tree_planting.json', network: 'q1_tree_planting_graph.json' };

function answersDir() {
	return process.env.Q1_ANSWERS_DIR || resolve(process.cwd(), '../../answers');
}

let raw;
function loadRaw() {
	if (!raw) {
		const dir = answersDir();
		raw = {
			findings: JSON.parse(readFileSync(resolve(dir, FILES.findings), 'utf8')),
			network: JSON.parse(readFileSync(resolve(dir, FILES.network), 'utf8'))
		};
	}
	return raw;
}

const width = (studies) => Math.round(Math.min(7, 1.5 + 0.6 * studies) * 10) / 10;

/** [document_id, number of this edge's claims from it], most claims first */
function docsOf(edgeIds, evidence) {
	const m = new Map();
	for (const cid of edgeIds) {
		const doc = evidence[cid]?.document_id;
		if (doc != null) m.set(doc, (m.get(doc) ?? 0) + 1);
	}
	return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function papersOf(data, edgeList, extra = {}) {
	const papers = new Map();
	for (const ev of Object.values(data.evidence)) {
		const p = papers.get(ev.document_id);
		if (p) p.claims += 1;
		else
			papers.set(ev.document_id, {
				id: ev.document_id,
				title: ev.title,
				year: ev.year,
				doi: ev.doi,
				claims: 1,
				edges: [],
				interactions: []
			});
	}
	for (const e of edgeList)
		for (const doc of e.document_ids ?? []) papers.get(doc)?.edges.push(e.id);
	for (const [cid, list] of Object.entries(extra)) {
		const doc = data.evidence[cid]?.document_id;
		if (doc != null) papers.get(doc)?.interactions.push(...list);
	}
	return [...papers.values()].sort((a, b) => b.claims - a.claims);
}

function pooled(e) {
	return {
		direction: e.direction,
		certainty: e.certainty,
		certainty_rationale: e.certainty_rationale,
		studies: e.studies,
		claims: e.claims,
		study_directions: e.study_directions,
		claim_directions: e.claim_directions
	};
}

function panelA(A) {
	const factorIds = [];
	const outcomeIds = [];
	const labels = new Map();
	for (const f of [...A.findings, ...A.gaps]) {
		if (!labels.has(f.subject.id)) factorIds.push(f.subject.id);
		labels.set(f.subject.id, f.subject.label);
		if (!labels.has(f.outcome.id)) outcomeIds.push(f.outcome.id);
		labels.set(f.outcome.id, f.outcome.label);
	}
	const nodes = [...factorIds, ...outcomeIds].map((id) => ({
		id,
		label: labels.get(id),
		shape: outcomeIds.includes(id) ? 'outcome' : 'factor'
	}));
	const geom = layoutGraph({
		lanes: [
			{ groups: [{ key: 'factor', title: 'Factor', subtitle: 'the subject of each finding', nodeIds: factorIds }] },
			{ groups: [{ key: 'outcome', title: 'Outcome', subtitle: 'the outcome of each finding', nodeIds: outcomeIds }] }
		],
		nodes,
		edges: A.findings.map((f) => ({ id: f.id, kind: 'effect', source: f.subject.id, target: f.outcome.id, studies: f.studies })),
		gaps: A.gaps.map((g) => ({ id: g.id, source: g.subject.id, target: g.outcome.id })),
		laneGap: 320
	});
	const edges = A.findings.map((f) => ({
		id: f.id,
		kind: 'finding',
		source: f.subject.id,
		target: f.outcome.id,
		...pooled(f),
		docs: docsOf(f.edge_ids, A.evidence),
		lens: ['direct'],
		width: width(f.studies),
		geom: geom.edges[f.id]
	}));
	const interactions = A.interactions.map((i) => {
		const ev = A.evidence[i.edge_id];
		return {
			edge_id: i.edge_id,
			direction: i.direction,
			claim: ev && {
				subject: ev.subject,
				predicate: ev.predicate,
				negated: ev.negated,
				object: ev.object,
				direction: ev.direction,
				certainty_grade: ev.certainty_grade,
				quote: ev.quote,
				document_id: ev.document_id
			}
		};
	});
	const extra = Object.fromEntries(A.interactions.map((i) => [i.edge_id, [i.edge_id]]));
	return {
		key: 'findings',
		name: 'Findings',
		file: FILES.findings,
		id: A.id,
		rule: A.rule,
		how_built: A.how_built,
		limitations: A.limitations,
		nodes: nodes.map((n) => ({ ...n, geom: geom.nodes[n.id] })),
		edges,
		gaps: A.gaps.map((g) => ({
			id: g.id,
			source: g.subject.id,
			target: g.outcome.id,
			status: g.status,
			studies: g.studies,
			searched_for: g.searched_for,
			geom: geom.gaps[g.id]
		})),
		members: geom.members,
		headers: geom.headers,
		size: { w: geom.width, h: geom.height },
		papers: papersOf(A, A.findings, extra),
		interactions,
		setAside: [],
		counts: { claims: Object.keys(A.evidence).length },
		crossings: geom.crossings
	};
}

const LANE_OF = {
	planting_stock: [0, 0],
	site_treatment: [0, 1],
	combination: [0, 2],
	condition: [1, 0],
	outcome: [2, 0]
};
const GROUP_TITLE = {
	planting_stock: 'Planting stock',
	site_treatment: 'Site treatments',
	combination: 'Combination',
	condition: 'Conditions',
	outcome: 'Outcomes'
};

function panelB(B) {
	const kindOf = new Map(B.nodes.map((n) => [n.id, n.kind]));
	const lanes = [{ groups: [] }, { groups: [] }, { groups: [] }];
	for (const kind of Object.keys(LANE_OF)) {
		const [li] = LANE_OF[kind];
		const ids = B.nodes.filter((n) => n.kind === kind).map((n) => n.id);
		if (!ids.length) continue;
		lanes[li].groups.push({ key: kind, title: GROUP_TITLE[kind], subtitle: B.node_kinds?.[kind], nodeIds: ids });
	}
	// nodes of an unknown kind go to the middle lane, so nothing is dropped
	const known = new Set(Object.keys(LANE_OF));
	const odd = B.nodes.filter((n) => !known.has(n.kind)).map((n) => n.id);
	if (odd.length) lanes[1].groups.push({ key: 'other', title: 'Other', nodeIds: odd });

	const geom = layoutGraph({
		lanes,
		nodes: B.nodes,
		edges: B.edges.map((e) => ({
			id: e.id,
			kind: e.kind,
			source: e.source,
			target: e.target,
			targetEdge: e.target_edge,
			studies: e.studies
		})),
		gaps: B.gaps.map((g) => ({ id: g.id, source: g.source, target: g.target })),
		laneGap: [210, 150]
	});
	const stockOrTreat = (id) => ['planting_stock', 'site_treatment'].includes(kindOf.get(id));
	const moderatedIds = new Set(B.edges.filter((e) => e.kind === 'moderation').map((e) => e.target_edge));
	const lensOf = (e) => {
		const l = [];
		if (e.kind === 'effect' && stockOrTreat(e.source) && kindOf.get(e.target) === 'outcome') l.push('direct');
		if (kindOf.get(e.source) === 'condition' || kindOf.get(e.target) === 'condition') l.push('via');
		// the Interactions lens also keeps the edge a moderation points at, so the ◆ has context
		if (e.kind === 'moderation' || kindOf.get(e.source) === 'combination' || moderatedIds.has(e.id)) l.push('inter');
		return l;
	};
	const edges = B.edges.map((e) => ({
		id: e.id,
		kind: e.kind,
		source: e.source,
		target: e.target,
		target_edge: e.target_edge ?? null,
		direction_meaning: e.direction_meaning ?? null,
		...pooled(e),
		docs: docsOf(e.edge_ids, B.evidence),
		lens: lensOf(e),
		width: width(e.studies),
		geom: geom.edges[e.id]
	}));
	return {
		key: 'network',
		name: 'Network',
		file: FILES.network,
		id: B.id,
		rule: B.rule,
		how_built: B.how_built,
		limitations: B.limitations,
		node_kinds: B.node_kinds,
		edge_kinds: B.edge_kinds,
		nodes: B.nodes.map((n) => ({
			id: n.id,
			label: n.label,
			kind: n.kind,
			members: n.members ?? null,
			shape: n.kind,
			geom: geom.nodes[n.id]
		})),
		edges,
		gaps: B.gaps.map((g) => ({
			id: g.id,
			source: g.source,
			target: g.target,
			status: g.status,
			studies: g.studies ?? null,
			searched_for: g.searched_for,
			geom: geom.gaps[g.id]
		})),
		members: geom.members,
		headers: geom.headers,
		size: { w: geom.width, h: geom.height },
		papers: papersOf(B, B.edges),
		interactions: [],
		setAside: B.set_aside ?? [],
		counts: { claims: Object.keys(B.evidence).length },
		crossings: geom.crossings
	};
}

export function buildModel() {
	const { findings, network } = loadRaw();
	return { question: findings.question, A: panelA(findings), B: panelB(network) };
}

/** data/<key>.json: every claim of one panel, with its quote, and the claim ids of each edge */
export function evidenceFile(key) {
	const data = loadRaw()[key];
	if (!data) return null;
	const claims = {};
	for (const [cid, ev] of Object.entries(data.evidence)) {
		claims[cid] = {
			subject: ev.subject,
			predicate: ev.predicate,
			negated: ev.negated,
			object: ev.object,
			direction: ev.direction,
			certainty_grade: ev.certainty_grade,
			evidence_types: ev.evidence_types,
			comparator: ev.comparator,
			quote: ev.quote,
			document_id: ev.document_id
		};
	}
	const list = key === 'findings' ? data.findings : data.edges;
	const edges = Object.fromEntries(list.map((e) => [e.id, e.edge_ids]));
	return { source: `answers/${FILES[key]}`, claims, edges };
}
