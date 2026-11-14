<script>
	// The node-link view. Geometry comes from the build (layout.js); this file only
	// draws it and reports hover / focus / pin through one set of delegated handlers.
	// Pan and zoom use d3-zoom, loaded on first use so it is not in the first view.
	import EdgeChip from './EdgeChip.svelte';
	import { DIRS, plural } from '../format.js';

	let { model, ix, cls, showGaps, mounted, onhover, onleave, onpin } = $props();

	const network = $derived(model.key === 'network');
	// thick lines first so thin ones stay visible on top
	const edgesByWidth = $derived(
		model.edges.map((e, i) => ({ e, i })).sort((a, b) => b.e.width - a.e.width || a.i - b.i).map((x) => x.e)
	);
	const diamonds = $derived(model.edges.filter((e) => e.geom.diamond));
	const rx = (n) =>
		({ planting_stock: 14, factor: 14, site_treatment: 3, condition: n.geom.h / 2, outcome: 8, combination: 8 })[
			n.shape
		] ?? 8;
	const nodeAria = (n) =>
		`${n.label} (${ix.kindText(n)}): ${plural(ix.outEdges(n.id).length, 'edge', 'edges')} out, ${plural(
			ix.inEdges(n.id).length,
			'edge',
			'edges'
		)} in`;

	let svgEl = $state();
	let zt = $state('');
	let zoom = null;
	let zsel = null;
	let zIdentity = null;

	async function ensureZoom() {
		if (zoom) return;
		const [{ zoom: makeZoom, zoomIdentity }, { select }] = await Promise.all([
			import('d3-zoom'),
			import('d3-selection')
		]);
		if (zoom) return;
		zIdentity = zoomIdentity;
		zoom = makeZoom()
			.scaleExtent([0.6, 4])
			// wheel zooms only with Ctrl/Cmd (or a trackpad pinch); a mouse drag pans;
			// touch is left to the browser so the box scrolls natively on phones
			.filter((ev) =>
				ev.type === 'wheel' ? ev.ctrlKey || ev.metaKey : ev.type === 'mousedown' && ev.button === 0 && !ev.ctrlKey
			)
			.on('zoom', (ev) => (zt = ev.transform.toString()));
		zsel = select(svgEl).call(zoom).on('dblclick.zoom', null);
	}
	const pointerEnter = (ev) => ev.pointerType === 'mouse' && ensureZoom();
	async function zoomBy(k) {
		await ensureZoom();
		zoom.scaleBy(zsel, k);
	}
	async function resetView() {
		await ensureZoom();
		zoom.transform(zsel, zIdentity);
	}

	function itemOf(t) {
		const el = t?.closest?.('[data-k]');
		if (!el || !svgEl?.contains(el)) return null;
		const k = el.getAttribute('data-k');
		const i = k.indexOf(':');
		return { el, item: { type: k.slice(0, i), id: k.slice(i + 1) } };
	}
	/** the focusable element for an item (the chip for an edge, the label for a gap) */
	function focusable(r) {
		if (r.el.hasAttribute('tabindex')) return r.el;
		const k = r.el.getAttribute('data-k');
		for (const el of svgEl.querySelectorAll('[tabindex][data-k]')) if (el.getAttribute('data-k') === k) return el;
		return r.el;
	}
	const over = (ev) => {
		const r = itemOf(ev.target);
		if (r) onhover(r.item, focusable(r));
	};
	const out = (ev) => {
		const a = itemOf(ev.target);
		const b = itemOf(ev.relatedTarget);
		if (a && (!b || b.el.getAttribute('data-k') !== a.el.getAttribute('data-k'))) onleave();
	};
	const focusIn = (ev) => {
		const r = itemOf(ev.target);
		if (r) onhover(r.item, r.el, true);
	};
	const focusOut = () => onleave(true);
	const click = (ev) => {
		const r = itemOf(ev.target);
		if (r) onpin(r.item, focusable(r));
	};
	const key = (ev) => {
		if (ev.key !== 'Enter' && ev.key !== ' ') return;
		const r = itemOf(ev.target);
		if (r && r.el === ev.target) {
			ev.preventDefault();
			onpin(r.item, r.el);
		}
	};
</script>

<div class="graph-tools">
	<button type="button" class="tool" onclick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
	<button type="button" class="tool" onclick={() => zoomBy(0.8)} aria-label="Zoom out">−</button>
	<button type="button" class="tool" onclick={resetView}>Reset view</button>
	<a class="tool-link" href="#table-{model.key}">View as table</a>
</div>
<div class="graph-box" onpointerenter={pointerEnter} role="presentation">
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<svg
		bind:this={svgEl}
		class="graph graph-{model.key}"
		viewBox="0 0 {model.size.w} {model.size.h}"
		style="--minw:{Math.round(model.size.w * 0.72)}px;--maxw:{Math.round(model.size.w * 1.12)}px"
		role="group"
		aria-label="{model.name} graph: {plural(model.nodes.length, 'node', 'nodes')}, {plural(
			model.edges.length,
			'edge',
			'edges'
		)}, {plural(model.gaps.length, 'gap', 'gaps')}. Each edge and node is a button; the table below lists the same edges."
		onclick={click}
		onkeydown={key}
		onpointerover={over}
		onpointerout={out}
		onfocusin={focusIn}
		onfocusout={focusOut}
	>
		<defs>
			{#each DIRS as d (d)}
				<marker
					id="{model.key}-arr-{d}"
					viewBox="0 0 10 10"
					refX="0"
					refY="5"
					markerWidth="10"
					markerHeight="10"
					markerUnits="userSpaceOnUse"
					orient="auto"
				>
					<path d="M0,0L10,5L0,10z" class="arrow fill-{d}" />
				</marker>
			{/each}
			<!-- certainty dots, filled of 4; chips reference these -->
			{#each [0, 1, 2, 3, 4] as n (n)}
				<g id="{model.key}-dots-{n}" class="dots4">
					{#each [0, 1, 2, 3] as i (i)}<circle class={i < n ? 'on' : ''} cx={-2.5 + i * 8.5} cy="0" r="3.1" />{/each}
				</g>
			{/each}
		</defs>
		<g transform={zt || undefined}>
			<g class="heads">
				{#each model.headers as h (h.key)}
					<text class="lane-title" x={h.x} y={h.y + 14}>{h.title}</text>
					{#each h.sub as s, i (i)}<text class="lane-sub" x={h.x} y={h.y + 31 + i * 14}>{s}</text>{/each}
				{/each}
			</g>
			<g class="members">
				{#each model.members as m (m.from)}
					<path class="member-line {cls.member(m)}" d={m.d} />
				{/each}
			</g>
			{#if showGaps}
				<g class="gaps">
					{#each model.gaps as g (g.id)}
						<path class="gap-line {cls.gap(g)}" d={g.geom.d} data-k="gap:{g.id}" />
					{/each}
				</g>
			{/if}
			<g class="edges">
				{#each edgesByWidth as e (e.id)}
					<g class="edge dir-{e.direction} kind-{e.kind} {cls.edge(e)}" data-k="edge:{e.id}">
						{#if mounted}<path class="halo" d={e.geom.d} stroke-width={e.width + 9} />{/if}
						<path
							class="line"
							d={e.geom.d}
							stroke-width={e.kind === 'moderation' ? 2.6 : e.width}
							marker-end={e.kind === 'moderation' ? undefined : `url(#${model.key}-arr-${e.direction})`}
						/>
						{#if mounted}<path class="hit" d={e.geom.d} />{/if}
					</g>
				{/each}
			</g>
			<g class="nodes">
				{#each model.nodes as n (n.id)}
					<g
						class="node shape-{n.shape} {cls.node(n)}"
						transform="translate({n.geom.x},{n.geom.y})"
						tabindex="0"
						role="button"
						aria-label={nodeAria(n)}
						data-k="node:{n.id}"
						data-node-id={network ? n.id : undefined}
					>
						<rect width={n.geom.w} height={n.geom.h} rx={rx(n)} />
						{#if n.members}
							<text class="combo-title" x="12" y="21">Combination</text>
							{#each n.members as m, i (m)}
								<rect class="member-chip" x="10" y={30 + i * 26} width={n.geom.w - 20} height="22" rx="6" />
								<text class="member-text" x="20" y={45 + i * 26}>{i ? '+ ' : ''}{ix.label(m)}</text>
							{/each}
						{:else}
							{#each n.geom.lines as l, i (i)}<text x="14" y={25 + i * 17}>{l}</text>{/each}
						{/if}
					</g>
				{/each}
			</g>
			<g class="chips">
				{#each model.edges as e (e.id)}
					<EdgeChip {e} aria={ix.aria(e)} {network} key={model.key} cls={cls.edge(e)} />
				{/each}
				{#each diamonds as e (e.id)}
					<path
						class="diamond dir-{e.direction} {cls.edge(e)}"
						transform="translate({e.geom.diamond.x},{e.geom.diamond.y})"
						d="M0,-7L7,0L0,7L-7,0Z"
					/>
				{/each}
				{#if showGaps}
					{#each model.gaps as g (g.id)}
						<g
							class="gap-label {cls.gap(g)}"
							transform="translate({g.geom.label.x},{g.geom.label.y})"
							tabindex="0"
							role="button"
							aria-label="{ix.label(g.source)} to {ix.label(g.target)}: no evidence. A gap, not a negative result."
							data-k="gap:{g.id}"
							data-gap-id={g.id}
						>
							<rect x="-46" y="-11" width="92" height="22" rx="11" />
							<text x="0" y="4.5" text-anchor="middle">No evidence</text>
						</g>
					{/each}
				{/if}
			</g>
		</g>
	</svg>
</div>
