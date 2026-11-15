<script>
	// L4 detail: the pinned item. Edges show their claims grouped by paper, with quotes (L5).
	import Dir from './Dir.svelte';
	import Cert from './Cert.svelte';
	import StudyBar from './StudyBar.svelte';
	import ClaimView from './ClaimView.svelte';
	import { plural, doiUrl, dirGlyph, dotsText } from '../format.js';
	import { groupByPaper } from '../panel.js';

	let { pin, model, ix, evidence, evState, onclose, onpin, headEl = $bindable() } = $props();

	const data = $derived(ix.resolve(pin));
	const claimEdges = $derived.by(() => {
		const m = new Map();
		if (evidence)
			for (const [eid, ids] of Object.entries(evidence.edges))
				for (const c of ids) (m.get(c) ?? m.set(c, []).get(c)).push(eid);
		return m;
	});
	const TYPE = $derived({
		edge: model.key === 'findings' ? 'Finding' : 'Edge',
		node: 'Node',
		gap: 'Gap',
		paper: 'Paper',
		claim: 'Claim'
	});
	const heading = $derived.by(() => {
		if (!data) return '';
		switch (pin.type) {
			case 'edge':
				return ix.title(data);
			case 'node':
				return data.label;
			case 'gap':
				return `${ix.label(data.source)} → ${ix.label(data.target)}`;
			case 'paper':
				return data.title ?? data.id;
			default:
				return pin.id;
		}
	});
	const touchesCondition = (e) =>
		ix.nodeById.get(e.source)?.kind === 'condition' || ix.nodeById.get(e.target)?.kind === 'condition';
	const open = (type, id) => (ev) => onpin({ type, id }, ev.currentTarget);
	const paperClaims = (doc) =>
		evidence ? Object.keys(evidence.claims).filter((cid) => evidence.claims[cid].document_id === doc) : [];
	const interactionOf = (cid) => model.interactions.find((i) => i.edge_id === cid);
</script>

{#snippet paperRef(doc, n)}
	{@const p = ix.paperById.get(doc)}
	<p class="ptitle">{p?.title ?? doc}</p>
	<p class="pmeta">
		{#if p?.year}{p.year} ·{/if}
		{#if p?.doi}<a href={doiUrl(p.doi)} rel="noopener">doi:{p.doi}</a>{:else}<span class="mono">{doc}</span> (no DOI){/if}
		{#if n != null}· {plural(n, 'claim', 'claims')}{/if}
	</p>
{/snippet}

{#snippet edgeButton(e)}
	<button type="button" class="linkish elink" onclick={open('edge', e.id)}>
		<span class="dir-{e.direction} g" aria-hidden="true">{dirGlyph(e.direction)}</span>
		<span class="d" aria-hidden="true">{dotsText(e.certainty)}</span>
		<span class="vh">{ix.aria(e)}</span><span class="t" aria-hidden="true">{ix.title(e)}</span>
	</button>
{/snippet}

{#snippet claimsBlock(ids)}
	{#if evidence}
		{#each groupByPaper(ids, evidence.claims) as [doc, list] (doc)}
			<section class="paper">
				{@render paperRef(doc, list.length)}
				{#each list as cid (cid)}<ClaimView id={cid} c={evidence.claims[cid]} />{/each}
			</section>
		{/each}
	{:else if evState === 'error'}
		<p class="note">The claims file could not be loaded. Open data/{model.key}.json directly.</p>
	{:else}
		<p class="note" aria-live="polite">Loading claims…</p>
	{/if}
{/snippet}

<aside class="drawer" aria-labelledby="drawer-h-{model.key}">
	<div class="drawer-head">
		<p class="eyebrow">{TYPE[pin.type] ?? pin.type}</p>
		<h3 id="drawer-h-{model.key}" tabindex="-1" bind:this={headEl}>{heading}</h3>
		<button type="button" class="close" onclick={onclose} aria-label="Close details">×</button>
	</div>
	<div class="drawer-body">
		{#if !data}
			<p class="note">Nothing in this panel has the id <span class="mono">{pin.id}</span>.</p>
		{:else if pin.type === 'edge'}
			{@const e = data}
			<p class="badges"><Dir d={e.direction} /> <Cert c={e.certainty} /></p>
			<p class="rationale"><span class="k">Certainty rationale</span> {e.certainty_rationale}</p>
			<p>{plural(e.studies, 'study', 'studies')} · {plural(e.claims, 'claim', 'claims')}</p>
			<div class="bars">
				<div><p class="k">By study</p><StudyBar counts={e.study_directions} /></div>
				<div><p class="k">By claim</p><StudyBar counts={e.claim_directions} label="Claim directions" /></div>
			</div>
			{#if e.kind === 'moderation'}
				<p class="rationale"><span class="k">Direction means</span> {e.direction_meaning}</p>
				{@const t = ix.edgeById.get(e.target_edge)}
				{#if t}<p><span class="k">Target edge</span> {@render edgeButton(t)}</p>{/if}
			{/if}
			{#if touchesCondition(e)}<p class="note path-note">{model.limitations[0]}</p>{/if}
			<h4>Claims, grouped by paper</h4>
			{@render claimsBlock(evidence?.edges[e.id])}
		{:else if pin.type === 'node'}
			{@const n = data}
			<p class="kind">{ix.kindText(n)}</p>
			{#if n.members}
				<p class="k">Members</p>
				<ul class="plain">
					{#each n.members as m (m)}<li>
							<button type="button" class="linkish" onclick={open('node', m)}>{ix.label(m)}</button>
						</li>{/each}
				</ul>
			{/if}
			{#if n.kind === 'condition'}
				<p class="note path-note">
					Edges into this condition and edges out of it are separate bodies of evidence. {model.limitations[0]}
				</p>
			{/if}
			{#if ix.outEdges(n.id).length}
				<h4>Out ({ix.outEdges(n.id).length})</h4>
				<ul class="plain">
					{#each ix.outEdges(n.id) as e (e.id)}<li>{@render edgeButton(e)}</li>{/each}
				</ul>
			{/if}
			{#if ix.inEdges(n.id).length}
				<h4>In ({ix.inEdges(n.id).length})</h4>
				<ul class="plain">
					{#each ix.inEdges(n.id) as e (e.id)}<li>{@render edgeButton(e)}</li>{/each}
				</ul>
			{/if}
			{#if ix.gapsOf(n.id).length}
				<h4>Gaps</h4>
				<ul class="plain">
					{#each ix.gapsOf(n.id) as g (g.id)}<li>
							<button type="button" class="linkish" onclick={open('gap', g.id)}
								>No evidence: {ix.label(g.source)} → {ix.label(g.target)}</button
							>
						</li>{/each}
				</ul>
			{/if}
		{:else if pin.type === 'gap'}
			{@const g = data}
			<p class="gapword">No evidence</p>
			<p>No study in this corpus tested this pairing. This is a gap, not a negative result.</p>
			<p class="rationale"><span class="k">Searched for</span> {g.searched_for}</p>
			<p class="mono small">status: {g.status}</p>
		{:else if pin.type === 'paper'}
			{@const p = data}
			{@render paperRef(p.id, p.claims)}
			{#if p.edges.length}
				<h4>Cited by</h4>
				<ul class="plain">
					{#each p.edges as id (id)}{@const e = ix.edgeById.get(id)}{#if e}<li>{@render edgeButton(e)}</li>{/if}{/each}
				</ul>
			{/if}
			{#if p.interactions.length}<p>Also cited by {plural(p.interactions.length, 'interaction claim', 'interaction claims')}.</p>{/if}
			<h4>Claims from this paper</h4>
			{#if evidence}
				{#each paperClaims(p.id) as cid (cid)}<ClaimView id={cid} c={evidence.claims[cid]} />{/each}
			{:else}<p class="note">Loading claims…</p>{/if}
		{:else if pin.type === 'claim'}
			{#if evidence?.claims[pin.id]}
				{@const c = evidence.claims[pin.id]}
				{@render paperRef(c.document_id, null)}
				<ClaimView id={pin.id} {c} />
				{#each claimEdges.get(pin.id) ?? [] as eid (eid)}
					{@const e = ix.edgeById.get(eid)}
					{#if e}<p><span class="k">Pooled in</span> {@render edgeButton(e)}</p>{/if}
				{/each}
				{#if interactionOf(pin.id)}<p>Listed under Interactions, not pooled.</p>{/if}
			{:else if evidence}
				<p class="note">No claim with this id in this panel.</p>
			{:else}<p class="note">Loading claims…</p>{/if}
		{/if}
	</div>
</aside>
