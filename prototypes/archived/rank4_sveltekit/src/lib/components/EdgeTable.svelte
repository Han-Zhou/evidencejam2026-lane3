<script>
	// Findings (Panel A) / Edges (Panel B): one row per pooled finding or edge.
	// Rows carry the machine-check data-* attributes. Sortable headers.
	import Dir from './Dir.svelte';
	import Cert from './Cert.svelte';
	import StudyBar from './StudyBar.svelte';
	import { DIRS, certRank } from '../format.js';

	let { model, ix, rowVisible, onpin, mounted, pinKey } = $props();

	const network = $derived(model.key === 'network');
	const COLS = [
		['from', 'From'],
		['to', 'To'],
		['direction', 'Direction'],
		['certainty', 'Certainty'],
		['studies', 'Studies'],
		['claims', 'Claims']
	];
	const LIMIT = 25;
	let sortKey = $state(null);
	let sortDir = $state(1);
	let all = $state(false);

	const val = (e, k) =>
		k === 'from'
			? ix.fromLabel(e).toLowerCase()
			: k === 'to'
				? ix.toLabel(e).toLowerCase()
				: k === 'direction'
					? DIRS.indexOf(e.direction)
					: k === 'certainty'
						? certRank(e.certainty)
						: e[k];
	const rows = $derived.by(() => {
		const r = model.edges.map((e, i) => ({ e, i }));
		if (sortKey)
			r.sort((a, b) => {
				const x = val(a.e, sortKey);
				const y = val(b.e, sortKey);
				return (x < y ? -1 : x > y ? 1 : 0) * sortDir || a.i - b.i;
			});
		return r.map((x) => x.e);
	});
	const visible = $derived(rows.filter(rowVisible));
	const rank = $derived(new Map(visible.map((e, i) => [e.id, i])));
	function sort(k) {
		if (sortKey === k) sortDir = -sortDir;
		else {
			sortKey = k;
			sortDir = k === 'studies' || k === 'claims' || k === 'certainty' ? -1 : 1;
		}
	}
	const ariaSort = (k) => (sortKey === k ? (sortDir > 0 ? 'ascending' : 'descending') : 'none');
</script>

<table class="data edges">
	<caption>
		{network ? 'Edges' : 'Findings'}: {visible.length} of {model.edges.length} shown. Select a column name to sort.
	</caption>
	<thead>
		<tr>
			{#each COLS as [k, name] (k)}
				<th scope="col" aria-sort={ariaSort(k)}>
					<button type="button" class="sort" onclick={() => sort(k)}
						>{name}<span class="sort-ind" aria-hidden="true"
							>{sortKey === k ? (sortDir > 0 ? '▲' : '▼') : '↕'}</span
						></button
					>
				</th>
			{/each}
			<th scope="col">Study directions</th>
			<th scope="col">Quotes</th>
		</tr>
	</thead>
	<tbody>
		{#each rows as e (e.id)}
			<tr
				data-finding-id={network ? undefined : e.id}
				data-edge-id={network ? e.id : undefined}
				data-direction={e.direction}
				data-certainty={e.certainty}
				data-studies={e.studies}
				data-claims={e.claims}
				class:pinned={pinKey === `edge:${e.id}`}
				hidden={!rank.has(e.id) || (mounted && !all && rank.get(e.id) >= LIMIT)}
			>
				<td>{ix.fromLabel(e)}</td>
				<td
					>{ix.toLabel(e)}{#if e.kind === 'moderation'}
						<span class="tag">moderation</span>{/if}</td
				>
				<td><Dir d={e.direction} /></td>
				<td class="certcell"
					><Cert c={e.certainty} /><span class="rationale">{e.certainty_rationale}</span></td
				>
				<td class="num">{e.studies}</td>
				<td class="num">{e.claims}</td>
				<td><StudyBar counts={e.study_directions} bar={false} /></td>
				<td
					><button
						type="button"
						class="open"
						onclick={(ev) => onpin({ type: 'edge', id: e.id }, ev.currentTarget)}
						aria-label="Open quotes: {ix.title(e)}">Open</button
					></td
				>
			</tr>
		{/each}
	</tbody>
</table>
{#if mounted && !all && visible.length > LIMIT}
	<button type="button" class="more" onclick={() => (all = true)}>Show all {visible.length}</button>
{/if}
