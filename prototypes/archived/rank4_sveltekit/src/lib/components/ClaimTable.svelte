<script>
	// Every evidence entry of the panel. The quotes live in data/<panel>.json and
	// load on demand, so they are shipped once and are not in the first view.
	import Dir from './Dir.svelte';
	import Cert from './Cert.svelte';
	import { DIRS, CERTS, dirWord, certWord, doiUrl } from '../format.js';

	let { ix, evidence, onpin, claimVisible } = $props();

	const LIMIT = 25;
	let dir = $state('');
	let grade = $state('');
	let all = $state(false);
	const ids = $derived(Object.keys(evidence.claims));
	const dirs = $derived(DIRS.filter((d) => ids.some((id) => evidence.claims[id].direction === d)));
	const grades = $derived(CERTS.filter((g) => ids.some((id) => evidence.claims[id].certainty_grade === g)));
	const rows = $derived(
		ids.filter((id) => {
			const c = evidence.claims[id];
			return (!dir || c.direction === dir) && (!grade || c.certainty_grade === grade) && claimVisible(id);
		})
	);
	const shown = $derived(all ? rows : rows.slice(0, LIMIT));
</script>

<div class="claim-filters">
	<label
		>Claim direction
		<select bind:value={dir}>
			<option value="">All</option>
			{#each dirs as d (d)}<option value={d}>{dirWord(d)}</option>{/each}
		</select>
	</label>
	<label
		>Claim grade
		<select bind:value={grade}>
			<option value="">All</option>
			{#each grades as g (g)}<option value={g}>{certWord(g)}</option>{/each}
		</select>
	</label>
</div>
<table class="data claims">
	<caption>Claims: {rows.length} of {ids.length} shown.</caption>
	<thead>
		<tr>
			<th scope="col">Claim</th>
			<th scope="col">Direction</th>
			<th scope="col">Grade</th>
			<th scope="col">Quote</th>
			<th scope="col">Paper</th>
		</tr>
	</thead>
	<tbody>
		{#each shown as id (id)}
			{@const c = evidence.claims[id]}
			{@const p = ix.paperById.get(c.document_id)}
			<tr>
				<td>
					<button type="button" class="linkish" onclick={(ev) => onpin({ type: 'claim', id }, ev.currentTarget)}
						>{c.subject} → {c.object}</button
					>
					<span class="small muted">{c.predicate}{c.negated ? ' (negated)' : ''}</span>
					<span class="cid">{id}</span>
				</td>
				<td><Dir d={c.direction} /></td>
				<td><Cert c={c.certainty_grade} /></td>
				<td><blockquote>{c.quote}</blockquote></td>
				<td class="small">
					{p?.title ?? c.document_id}{p?.year ? ` (${p.year})` : ''}
					{#if p?.doi}<a href={doiUrl(p.doi)} rel="noopener">doi</a>{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
{#if !all && rows.length > LIMIT}
	<button type="button" class="more" onclick={() => (all = true)}>Show all {rows.length}</button>
{/if}
