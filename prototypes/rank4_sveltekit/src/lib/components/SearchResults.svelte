<script>
	// Grouped search results (Nodes · Edges/Findings · Gaps · Papers · Claims). Choosing one pins it.
	import { dirGlyph, dotsText } from '../format.js';

	let { hits, ix, evidence, evState, onpin, network } = $props();
	const SHOW = 6;
	let more = $state({});

	const groups = $derived([
		{ name: 'Nodes', list: hits.nodes.map((n) => ({ item: { type: 'node', id: n.id }, text: n.label })) },
		{
			name: network ? 'Edges' : 'Findings',
			list: hits.edges.map((e) => ({ item: { type: 'edge', id: e.id }, text: ix.title(e), e }))
		},
		{
			name: 'Gaps',
			list: hits.gaps.map((g) => ({
				item: { type: 'gap', id: g.id },
				text: `No evidence: ${ix.label(g.source)} → ${ix.label(g.target)}`
			}))
		},
		{
			name: 'Papers',
			list: hits.papers.map((p) => ({
				item: { type: 'paper', id: p.id },
				text: `${p.title ?? p.id}${p.year ? ` (${p.year})` : ''}`
			}))
		},
		{
			name: 'Claims',
			list: hits.claims.map((id) => ({
				item: { type: 'claim', id },
				text: `${evidence.claims[id].subject} → ${evidence.claims[id].object}`
			}))
		}
	]);
	const total = $derived(groups.reduce((s, g) => s + g.list.length, 0));
</script>

<div class="results" role="region" aria-label="Search results">
	<p class="results-sum" aria-live="polite">
		{total} results{#if evState === 'loading'}; loading the claims…{/if}
	</p>
	<div class="results-groups">
		{#each groups as g (g.name)}
			<div class="rgroup">
				<p class="rg-title">{g.name} <span class="count">{g.list.length}</span></p>
				{#if g.list.length}
					<ul class="plain">
						{#each more[g.name] ? g.list : g.list.slice(0, SHOW) as r (r.item.id)}
							<li>
								<button type="button" class="linkish" onclick={(ev) => onpin(r.item, ev.currentTarget)}>
									{#if r.e}<span class="dir-{r.e.direction} g" aria-hidden="true">{dirGlyph(r.e.direction)}</span>
										<span class="d" aria-hidden="true">{dotsText(r.e.certainty)}</span>{/if}
									{r.text}
								</button>
							</li>
						{/each}
					</ul>
					{#if g.list.length > SHOW && !more[g.name]}
						<button type="button" class="more" onclick={() => (more[g.name] = true)}>Show all {g.list.length}</button>
					{/if}
				{:else}
					<p class="muted small">None</p>
				{/if}
			</div>
		{/each}
	</div>
</div>
