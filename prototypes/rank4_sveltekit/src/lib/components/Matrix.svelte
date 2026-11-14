<script>
	// Matrix view (SPEC 3.6.5): rows = sources, columns = targets, one cell per edge.
	// A listed gap is a hatched "No evidence" cell; a blank cell is no claim, never a negative.
	import { CERT_DOTS, dirGlyph } from '../format.js';

	let { model, ix, cls, showGaps, onselect } = $props();

	const byPos = (a, b) => a.geom.x - b.geom.x || a.geom.y - b.geom.y;
	const rows = $derived(
		model.nodes.filter((n) => model.edges.some((e) => e.source === n.id) || model.gaps.some((g) => g.source === n.id)).sort(byPos)
	);
	const cols = $derived([
		...model.nodes
			.filter((n) => model.edges.some((e) => e.target === n.id) || model.gaps.some((g) => g.target === n.id))
			.sort(byPos)
			.map((n) => ({ key: n.id, label: n.label, edge: false })),
		...[...new Set(model.edges.filter((e) => e.target_edge).map((e) => e.target_edge))].map((id) => {
			const t = ix.edgeById.get(id);
			return { key: `edge:${id}`, label: `Effect of ${t ? `${ix.label(t.source)} → ${ix.label(t.target)}` : id}`, edge: true };
		})
	]);
	const cell = $derived.by(() => {
		const m = new Map();
		for (const e of model.edges)
			m.set(`${e.source}|${e.kind === 'moderation' ? `edge:${e.target_edge}` : e.target}`, { type: 'edge', v: e });
		for (const g of model.gaps) m.set(`${g.source}|${g.target}`, { type: 'gap', v: g });
		return m;
	});

	let box = $state();
	function itemOf(t) {
		const el = t?.closest?.('[data-k]');
		if (!el || !box?.contains(el)) return null;
		const k = el.getAttribute('data-k');
		const i = k.indexOf(':');
		return { el, item: { type: k.slice(0, i), id: k.slice(i + 1) } };
	}
	// cells are buttons: Enter / Space arrive here as a click with detail 0
	const click = (ev) => {
		const r = itemOf(ev.target);
		if (r) onselect(r.item, r.el, ev.detail === 0);
	};
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="matrix-box" bind:this={box} onclick={click}>
	<table class="matrix">
		<caption>{model.name}: sources (rows) by targets (columns). Same glyph and dots as the graph.</caption>
		<thead>
			<tr>
				<td></td>
				{#each cols as c (c.key)}<th scope="col" class:edgecol={c.edge}>{c.label}</th>{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.id)}
				<tr>
					<th scope="row">{r.label}</th>
					{#each cols as c (c.key)}
						{@const x = cell.get(`${r.id}|${c.key}`)}
						{#if x?.type === 'edge'}
							{@const n = CERT_DOTS[x.v.certainty] ?? 0}
							<td class="mcell {cls.edge(x.v)}">
								<button type="button" class="mchip dir-{x.v.direction}" data-k="edge:{x.v.id}" aria-label={ix.aria(x.v)}>
									<span class="glyph" aria-hidden="true">{dirGlyph(x.v.direction)}</span><span
										class="dots"
										aria-hidden="true">{'●'.repeat(n)}{'○'.repeat(4 - n)}</span
									>
								</button>
							</td>
						{:else if x?.type === 'gap' && showGaps}
							<td class="mgap {cls.gap(x.v)}">
								<button
									type="button"
									class="mgap-btn"
									data-k="gap:{x.v.id}"
									aria-label="{r.label} to {c.label}: no evidence. A gap, not a negative result."
									>No evidence</button
								>
							</td>
						{:else}
							<td class="mempty" title="No claims in this corpus link these two"><span class="vh">No claims in this corpus link these two</span></td>
						{/if}
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
