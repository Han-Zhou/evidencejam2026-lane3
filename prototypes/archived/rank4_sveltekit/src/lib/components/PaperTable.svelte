<script>
	// One row per distinct document_id in this panel's evidence.
	import { doiUrl } from '../format.js';

	let { model, ix, onpin, paperVisible } = $props();

	const LIMIT = 25;
	let all = $state(false);
	const visible = $derived(model.papers.filter(paperVisible));
	const rank = $derived(new Map(visible.map((p, i) => [p.id, i])));
</script>

<table class="data papers">
	<caption>Papers: {visible.length} of {model.papers.length} shown, most claims first.</caption>
	<thead>
		<tr>
			<th scope="col">Title</th>
			<th scope="col">Year</th>
			<th scope="col">DOI or id</th>
			<th scope="col">Claims</th>
			<th scope="col">Cited by</th>
		</tr>
	</thead>
	<tbody>
		{#each model.papers as p (p.id)}
			<tr hidden={!rank.has(p.id) || (!all && rank.get(p.id) >= LIMIT)}>
				<td
					><button type="button" class="linkish" onclick={(ev) => onpin({ type: 'paper', id: p.id }, ev.currentTarget)}
						>{p.title ?? p.id}</button
					></td
				>
				<td>{p.year ?? '—'}</td>
				<td class="doi"
					>{#if p.doi}<a href={doiUrl(p.doi)} rel="noopener">{p.doi}</a>{:else}<span class="mono">{p.id}</span>{/if}</td
				>
				<td class="num">{p.claims}</td>
				<td>
					<ul class="cites">
						{#each p.edges as id (id)}
							{@const e = ix.edgeById.get(id)}
							{#if e}<li>
									<button type="button" class="linkish small" onclick={(ev) => onpin({ type: 'edge', id }, ev.currentTarget)}
										>{ix.title(e)}</button
									>
								</li>{/if}
						{/each}
						{#if p.interactions.length}<li class="muted">Interactions ({p.interactions.length})</li>{/if}
					</ul>
				</td>
			</tr>
		{/each}
	</tbody>
</table>
{#if !all && visible.length > LIMIT}
	<button type="button" class="more" onclick={() => (all = true)}>Show all {visible.length}</button>
{/if}
