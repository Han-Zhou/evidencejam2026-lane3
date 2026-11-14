<script>
	// L3 preview: floats next to the hovered or focused node, edge or gap.
	import Dir from './Dir.svelte';
	import Cert from './Cert.svelte';
	import StudyBar from './StudyBar.svelte';
	import { plural, dirGlyph, dirWord, dotsText, certWord } from '../format.js';

	let { hover, model, ix, id } = $props();

	let vw = $state(1200);
	let vh = $state(800);
	let h = $state(0);

	const data = $derived(hover ? ix.resolve(hover.item) : null);
	const pos = $derived.by(() => {
		if (!hover) return { x: 0, y: 0, w: 340 };
		const r = hover.rect;
		const w = Math.min(340, vw - 16);
		let x = r.right + 12;
		let y = r.top - 4;
		if (x + w > vw - 8) x = r.left - 12 - w;
		if (x < 8) {
			x = Math.max(8, Math.min(vw - w - 8, r.left));
			y = r.bottom + 8;
			if (y + h > vh - 8) y = r.top - h - 8;
		}
		y = Math.max(8, Math.min(y, vh - h - 8));
		return { x, y, w };
	});
	const nodeEdges = (n) => [...ix.outEdges(n.id), ...ix.inEdges(n.id)];
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

{#if hover && data}
	<div
		class="hovercard"
		role="tooltip"
		{id}
		style="left:{pos.x}px;top:{pos.y}px;width:{pos.w}px"
		bind:offsetHeight={h}
	>
		{#if hover.item.type === 'edge'}
			{@const e = data}
			<p class="hc-title">{ix.title(e)}</p>
			<p class="hc-badges"><Dir d={e.direction} /> <Cert c={e.certainty} /></p>
			{#if e.kind === 'moderation'}
				<p class="hc-line"><span class="k">Changes the effect of</span> {ix.toLabel(e)}</p>
				<p class="hc-line"><span class="k">Direction means</span> {e.direction_meaning}</p>
			{/if}
			<p class="hc-rationale">{e.certainty_rationale}</p>
			<p class="hc-line">{plural(e.studies, 'study', 'studies')} · {plural(e.claims, 'claim', 'claims')}</p>
			<StudyBar counts={e.study_directions} />
			<ul class="hc-papers">
				{#each e.docs.slice(0, 3) as [doc] (doc)}
					{@const p = ix.paperById.get(doc)}
					<li>{p?.title ?? doc}{p?.year ? ` (${p.year})` : ''}</li>
				{/each}
			</ul>
			{#if e.docs.length > 3}<p class="hc-more">+{e.docs.length - 3} more</p>{/if}
			<p class="hc-hint">Click to pin and read the quotes</p>
		{:else if hover.item.type === 'node'}
			{@const n = data}
			<p class="hc-title">{n.label}</p>
			<p class="hc-kind">{ix.kindText(n)}</p>
			{#if n.members}
				<p class="hc-line"><span class="k">Members</span> {n.members.map(ix.label).join(' + ')}</p>
			{/if}
			<p class="hc-line">
				{plural(ix.inEdges(n.id).length, 'edge', 'edges')} in · {plural(ix.outEdges(n.id).length, 'edge', 'edges')} out
			</p>
			<ul class="hc-edges">
				{#each nodeEdges(n).slice(0, 10) as e (e.id)}
					<li>
						<span class="dir-{e.direction} g" aria-hidden="true">{dirGlyph(e.direction)}</span>
						<span class="d" aria-hidden="true">{dotsText(e.certainty)}</span>
						<span class="vh">{dirWord(e.direction)}, certainty {certWord(e.certainty)}:</span>
						{e.source === n.id ? `→ ${ix.toLabel(e)}` : `← ${ix.fromLabel(e)}`}
					</li>
				{/each}
			</ul>
			{#if nodeEdges(n).length > 10}<p class="hc-more">+{nodeEdges(n).length - 10} more</p>{/if}
			{#if n.kind === 'condition'}
				<p class="hc-note">{model.limitations[0]}</p>
			{/if}
			<p class="hc-hint">Click to pin</p>
		{:else if hover.item.type === 'gap'}
			{@const g = data}
			<p class="hc-title">{ix.label(g.source)} → {ix.label(g.target)}</p>
			<p class="hc-gap">No evidence</p>
			<p class="hc-line">No study in this corpus tested this pairing. This is a gap, not a negative result.</p>
			<p class="hc-line"><span class="k">Searched for</span> {g.searched_for}</p>
		{/if}
	</div>
{/if}
