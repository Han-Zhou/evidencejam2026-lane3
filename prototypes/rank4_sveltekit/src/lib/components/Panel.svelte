<script>
	// One panel (A "Findings" or B "Network"): L1 summary, toolbar, graph/matrix,
	// selection status line, drawer, tables. All its views share one filter/search state.
	import { tick } from 'svelte';
	import Graph from './Graph.svelte';
	import EdgeTable from './EdgeTable.svelte';
	import Legend from './Legend.svelte';
	import Dir from './Dir.svelte';
	// Not in the first view: loaded when first needed (separate chunks, not preloaded)
	const lazyDrawer = () => import('./Drawer.svelte');
	const lazyMatrix = () => import('./Matrix.svelte');
	const lazyResults = () => import('./SearchResults.svelte');
	const lazyClaims = () => import('./ClaimTable.svelte');
	const lazyPapers = () => import('./PaperTable.svelte');
	let papersOpen = $state(false);
	import Cert from './Cert.svelte';
	import { DIRS, CERTS, dirGlyph, dirWord, certWord, dotsText, certRank, plural, doiUrl } from '../format.js';
	import { makeIndex, emphasis } from '../panel.js';

	let { model, active, mounted, pin, onpin } = $props();

	const ix = $derived(makeIndex(model));
	const network = $derived(model.key === 'network');
	const K = $derived(model.key);
	const unit = $derived(network ? ['edge', 'edges'] : ['finding', 'findings']);

	// ---- shared view state ----
	let query = $state('');
	let lens = $state('all');
	let dirOn = $state({ increase: true, decrease: true, mixed: true, no_effect: true, unclear: true });
	let minCert = $state('very_low');
	let showGaps = $state(true);
	let view = $state('graph');
	let evidence = $state.raw(null);
	let evState = $state('idle');
	let drawerHead = $state();
	let opener = null;

	async function loadEvidence() {
		if (evidence || evState === 'loading') return;
		evState = 'loading';
		try {
			const res = await fetch(new URL(`data/${K}.json`, document.baseURI));
			if (!res.ok) throw new Error(String(res.status));
			evidence = await res.json();
			evState = 'ready';
		} catch {
			evState = 'error';
		}
	}
	// node and gap details need no quotes, so only edges, papers and claims fetch the file
	const needsQuotes = (item) => !!item && item.type !== 'node' && item.type !== 'gap';
	$effect(() => {
		if (needsQuotes(pin)) loadEvidence();
	});

	// ---- filters, lens, search ----
	const passFilter = (e) => dirOn[e.direction] !== false && certRank(e.certainty) >= certRank(minCert);
	const passLens = (e) => lens === 'all' || e.lens.includes(lens);
	const q = $derived(query.trim().toLowerCase());
	const hits = $derived.by(() => {
		if (!q) return null;
		const has = (s) => s != null && String(s).toLowerCase().includes(q);
		const nodes = model.nodes.filter((n) => has(n.label));
		const papers = model.papers.filter((p) => has(p.title) || has(p.id));
		const titleHit = new Set(papers.map((p) => p.id));
		const claims = evidence
			? Object.keys(evidence.claims).filter((id) => {
					const c = evidence.claims[id];
					return has(c.subject) || has(c.object) || has(c.quote) || has(id);
				})
			: [];
		const claimSet = new Set(claims);
		const edges = model.edges.filter(
			(e) =>
				has(ix.fromLabel(e)) ||
				has(ix.toLabel(e)) ||
				e.docs.some(([d]) => titleHit.has(d)) ||
				(evidence?.edges[e.id] ?? []).some((c) => claimSet.has(c))
		);
		const gaps = model.gaps.filter((g) => has(ix.label(g.source)) || has(ix.label(g.target)));
		const paperSet = new Set(titleHit);
		for (const id of claims) paperSet.add(evidence.claims[id].document_id);
		return {
			nodes,
			papers,
			claims,
			edges,
			gaps,
			claimSet,
			paperSet,
			edgeSet: new Set(edges.map((e) => e.id)),
			gapSet: new Set(gaps.map((g) => g.id))
		};
	});
	const passSearch = (e) => !hits || hits.edgeSet.has(e.id);
	const shownEdges = $derived(model.edges.filter((e) => passFilter(e) && passSearch(e) && passLens(e)));
	const shownSet = $derived(new Set(shownEdges.map((e) => e.id)));
	const narrowed = $derived(lens !== 'all' || !!hits || shownEdges.length !== model.edges.length);
	const brightNodes = $derived.by(() => {
		const s = new Set();
		for (const e of shownEdges) {
			s.add(e.source);
			if (e.target) s.add(e.target);
		}
		if (hits) for (const n of hits.nodes) s.add(n.id);
		return s;
	});
	const gapBright = (g) => (!hits || hits.gapSet.has(g.id)) && (lens === 'all' || lens === 'direct');

	// ---- click selection (SPEC 3.6.1): the pinned node, edge or gap is the selection ----
	// No hover state: only a click (or Enter / Space) changes what is bright.
	const emph = $derived(pin ? emphasis(model, ix, pin) : null);
	const pinKey = $derived(pin ? `${pin.type}:${pin.id}` : '');
	const cls = {
		edge: (e) => {
			let c = '';
			if (emph) {
				const hop = emph.edges.get(e.id);
				if (hop == null) c += ' faded';
				else if (pin.type === 'node') c += hop === 1 ? ' near' : ' far';
			} else if (!shownSet.has(e.id)) c += ' faded';
			if (pinKey === `edge:${e.id}`) c += ' is-sel';
			return c;
		},
		node: (n) => {
			let c = '';
			if (emph) {
				if (!emph.nodes.has(n.id)) c += ' faded';
			} else if (narrowed && !brightNodes.has(n.id)) c += ' faded';
			if (pinKey === `node:${n.id}`) c += ' is-sel';
			return c;
		},
		gap: (g) => {
			let c = '';
			if (emph) {
				if (!emph.gaps.has(g.id)) c += ' faded';
			} else if (!gapBright(g)) c += ' faded';
			if (pinKey === `gap:${g.id}`) c += ' is-sel';
			return c;
		},
		member: (m) => {
			if (emph) return emph.members.has(`${m.from}|${m.to}`) ? '' : ' faded';
			return lens === 'all' || lens === 'inter' ? '' : ' faded';
		}
	};
	// status line counts: made by counting the bright edges, nothing else
	const hops = $derived.by(() => {
		if (!emph || pin.type !== 'node') return null;
		let near = 0;
		let far = 0;
		for (const h of emph.edges.values()) h === 1 ? near++ : far++;
		return { near, far, gaps: emph.gaps.size };
	});
	const selected = $derived(emph ? ix.resolve(pin) : null);

	// ---- selection, drawer, focus ----
	// the drawer component loads lazily, so focus moves once its heading exists
	let wantFocus = $state(false);
	let wantScroll = false;
	/** open an item in the drawer from a table, a search result or the drawer itself */
	function doPin(item, el) {
		opener = el ?? null;
		onpin(item);
		wantFocus = true;
		wantScroll = true;
	}
	/**
	 * a click (or Enter / Space) on a graph or matrix item. A second click on the
	 * selected item clears it. A mouse click keeps the page and the focus where they
	 * are, so the highlighted pathways stay in view; the keyboard goes to the drawer.
	 */
	function select(item, el, kbd) {
		if (pinKey === `${item.type}:${item.id}`) {
			if (kbd) closeDrawer();
			else clearSel();
			return;
		}
		opener = el ?? null;
		onpin(item);
		if (kbd) wantFocus = true;
	}
	/** click on empty canvas: clear a graph selection (a paper or claim stays open) */
	function clearSel() {
		if (emph) {
			opener = null;
			onpin(null);
		}
	}
	$effect(() => {
		if (!wantFocus || !drawerHead) return;
		wantFocus = false;
		drawerHead.focus({ preventScroll: true });
		const box = drawerHead.closest('.drawer');
		const r = box?.getBoundingClientRect();
		if (r && (wantScroll || matchMedia('(max-width: 860px)').matches) && (r.top > innerHeight - 80 || r.bottom < 80))
			box.scrollIntoView({ block: 'nearest' });
		wantScroll = false;
	});
	const toDrawer = () => drawerHead?.closest('.drawer')?.scrollIntoView({ block: 'start' });
	async function closeDrawer() {
		const o = opener;
		opener = null;
		onpin(null);
		await tick();
		if (o?.isConnected) o.focus();
	}
	function onKey(ev) {
		if (!active || ev.key !== 'Escape') return;
		if (pin) closeDrawer();
	}

	// ---- L1 counts (counting JSON entries only) ----
	const countBy = (list, f) => {
		const m = {};
		for (const x of list) m[f(x)] = (m[f(x)] ?? 0) + 1;
		return m;
	};
	const dirCounts = $derived(countBy(model.edges, (e) => e.direction));
	const certCounts = $derived(countBy(model.edges, (e) => e.certainty));
	const kindCounts = $derived(countBy(model.edges, (e) => e.kind));
	const nodeKindCounts = $derived(countBy(model.nodes, (n) => n.kind ?? n.shape));
	const resetFilters = () => {
		for (const d of DIRS) dirOn[d] = true;
		minCert = 'very_low';
		showGaps = true;
		lens = 'all';
		query = '';
	};
	const LENSES = [
		['all', 'All'],
		['direct', 'Direct'],
		['via', 'Via conditions'],
		['inter', 'Interactions']
	];
	const paperVisible = (p) =>
		(p.edges.length === 0 || p.edges.some((id) => passFilter(ix.edgeById.get(id)))) &&
		(!hits || hits.paperSet.has(p.id));
	const claimVisible = (id) => !hits || hits.claimSet.has(id);
	const interactionVisible = (it) =>
		!q ||
		[it.claim?.subject, it.claim?.object, it.claim?.quote, it.edge_id].some((s) => s?.toLowerCase().includes(q));
	const comboEdges = $derived(model.edges.filter((e) => e.kind === 'moderation' || ix.nodeById.get(e.source)?.members));
	const combos = $derived(model.nodes.filter((n) => n.members));
</script>

<svelte:window onkeydown={onKey} />

{#snippet paperRef(doc)}
	{@const p = ix.paperById.get(doc)}
	{p?.title ?? doc}{p?.year ? ` (${p.year})` : ''}
	{#if p?.doi}<a href={doiUrl(p.doi)} rel="noopener">doi:{p.doi}</a>{:else}<span class="mono">{doc}</span>{/if}
{/snippet}

<div class="panel" id="panel-{K}" role="tabpanel" aria-labelledby="tab-{K}" tabindex="-1">
	<div class="panel-head">
		<h2>{model.name}</h2>
		<p class="src">Source: <span class="mono">answers/{model.file}</span> · rule <span class="mono">{model.rule}</span></p>
	</div>

	<section class="glance" aria-labelledby="glance-{K}">
		<h3 id="glance-{K}">At a glance</h3>
		<div class="glance-grid">
			<div class="gl-block">
				<p class="gl-k">{plural(model.edges.length, unit[0], unit[1])} by direction</p>
				<ul class="gl-list">
					{#each DIRS.filter((d) => dirCounts[d]) as d (d)}
						<li><span class="gl-n">{dirCounts[d]}</span> <Dir {d} /></li>
					{/each}
				</ul>
			</div>
			<div class="gl-block">
				<p class="gl-k">By certainty</p>
				<ul class="gl-list">
					{#each [...CERTS].reverse().filter((c) => certCounts[c]) as c (c)}
						<li><span class="gl-n">{certCounts[c]}</span> <Cert {c} /></li>
					{/each}
				</ul>
			</div>
			<div class="gl-block">
				<p class="gl-k">Gaps and more</p>
				<ul class="gl-list">
					<li><span class="gl-n">{model.gaps.length}</span> <span class="gapword">No evidence</span> (gap)</li>
					{#if network}
						<li><span class="gl-n">{kindCounts.effect ?? 0}</span> effect edges</li>
						<li><span class="gl-n">{kindCounts.moderation ?? 0}</span> moderation edge{kindCounts.moderation === 1 ? '' : 's'}</li>
						<li>
							<span class="gl-n">{model.nodes.length}</span> nodes: {Object.entries(nodeKindCounts)
								.map(([k, n]) => `${n} ${k.replaceAll('_', ' ')}`)
								.join(', ')}
						</li>
					{:else}
						<li><span class="gl-n">{model.interactions.length}</span> interaction claims (listed, not pooled)</li>
					{/if}
					<li><span class="gl-n">{model.counts.claims}</span> claims · <span class="gl-n">{model.papers.length}</span> papers</li>
				</ul>
			</div>
		</div>
		<details class="built">
			<summary>How this was built</summary>
			<p>{model.how_built}</p>
			<p class="small muted">Certainty rule: <span class="mono">{model.rule}</span> (see README, "How certainty is graded").</p>
		</details>
	</section>

	<div class="toolbar" role="search" aria-label="{model.name}: search and filters">
		<div class="tb-row">
			<label class="search">
				<span class="vh">Search {model.name}</span>
				<input
					id="search-{K}"
					type="search"
					placeholder="Search nodes, claims, quotes, papers  ( / )"
					autocomplete="off"
					bind:value={query}
					onfocus={loadEvidence}
					oninput={loadEvidence}
					onkeydown={(ev) => {
						if (ev.key === 'Escape') {
							ev.stopPropagation();
							query = '';
						}
					}}
				/>
			</label>
			{#if network}
				<div class="seg" role="group" aria-label="Lens">
					<span class="seg-k" aria-hidden="true">Lens</span>
					{#each LENSES as [k, name] (k)}
						<button type="button" aria-pressed={lens === k} onclick={() => (lens = k)}>{name}</button>
					{/each}
				</div>
			{/if}
		</div>
		<div class="tb-row">
			<div class="chips-filter" role="group" aria-label="Direction filter">
				<span class="seg-k" aria-hidden="true">Direction</span>
				{#each DIRS.filter((d) => dirCounts[d]) as d (d)}
					<button type="button" class="fchip dir-{d}" aria-pressed={dirOn[d]} onclick={() => (dirOn[d] = !dirOn[d])}>
						<span class="glyph" aria-hidden="true">{dirGlyph(d)}</span>
						{dirWord(d)}
					</button>
				{/each}
			</div>
			<label class="sel"
				>Min. certainty
				<select bind:value={minCert}>
					{#each CERTS as c (c)}<option value={c}>{c === 'very_low' ? 'Any' : `${certWord(c)} or higher`}</option>{/each}
				</select>
			</label>
			<label class="check"><input type="checkbox" bind:checked={showGaps} /> Show gaps</label>
			<p class="count" aria-live="polite">Showing {shownEdges.length} of {plural(model.edges.length, unit[0], unit[1])}</p>
			{#if narrowed || !showGaps}<button type="button" class="more" onclick={resetFilters}>Reset</button>{/if}
		</div>
	</div>

	{#if hits}
		{#await lazyResults() then { default: SearchResults }}
			<SearchResults {hits} {ix} {evidence} {evState} {network} onpin={doPin} />
		{/await}
	{/if}

	<div class="work" class:has-drawer={!!pin}>
		<section class="viz" id="graph-{K}" aria-labelledby="viz-{K}">
			<div class="viz-head">
				<h3 id="viz-{K}">{view === 'graph' ? 'Graph' : 'Matrix'}</h3>
				<div class="seg" role="group" aria-label="View">
					<button type="button" aria-pressed={view === 'graph'} onclick={() => (view = 'graph')}>Graph</button>
					<button type="button" aria-pressed={view === 'matrix'} onclick={() => (view = 'matrix')}>Matrix</button>
				</div>
			</div>
			{#if network}
				<p class="path-note"><span class="k">Paths</span> {model.limitations[0]}</p>
			{/if}
			<div class="sel-status" class:on={!!emph}>
				<div class="st-text" aria-live="polite">
					{#if hops && selected}
						{@const n = hops.near + hops.far}
						<p>
							Pathways through <strong>{selected.label}</strong>:
							<span class="st-n">{n}</span>
							{n === 1 ? unit[0] : unit[1]} (<span class="st-n">{hops.near}</span> direct,
							<span class="st-n">{hops.far}</span> further){#if hops.gaps}
								· <span class="st-n">{hops.gaps}</span> {hops.gaps === 1 ? 'gap' : 'gaps'} (no evidence){/if}
						</p>
						{#if hops.far}
							<p class="st-honesty">
								Edges beyond the first step are separate bodies of evidence. A path is not one tested effect.
							</p>
						{/if}
					{:else if emph && selected && pin.type === 'edge'}
						<p>
							Selected {network ? 'edge' : 'finding'}: <strong>{ix.title(selected)}</strong> · {dirWord(selected.direction)} ·
							certainty {certWord(selected.certainty)} · <span class="st-n">{selected.studies}</span>
							{selected.studies === 1 ? 'study' : 'studies'} · <span class="st-n">{selected.claims}</span>
							{selected.claims === 1 ? 'claim' : 'claims'}
						</p>
					{:else if emph && selected && pin.type === 'gap'}
						<p>
							Selected gap: <strong>{ix.label(selected.source)} → {ix.label(selected.target)}</strong> · No evidence (a gap,
							not a negative result)
						</p>
					{:else}
						<p class="st-hint">
							Click a node to show its pathways. Click an edge or its chip to read its claims. A second click, a click on
							empty space or Esc clears it.
						</p>
					{/if}
				</div>
				{#if emph}
					<div class="st-actions">
						<button type="button" class="pill" onclick={closeDrawer}>Clear</button>
						<button type="button" class="more to-drawer" onclick={toDrawer}>Details below ↓</button>
					</div>
				{/if}
			</div>
			{#if view === 'graph'}
				<Graph {model} {ix} {cls} {showGaps} {mounted} selKey={pinKey} onselect={select} onclear={clearSel} />
			{:else}
				{#await lazyMatrix() then { default: Matrix }}
					<Matrix {model} {ix} {cls} {showGaps} onselect={select} />
				{/await}
			{/if}
			<Legend {model} />
		</section>
		{#if pin}
			{#await lazyDrawer() then { default: Drawer }}
				<Drawer
					{pin}
					{model}
					{ix}
					{evidence}
					{evState}
					onclose={closeDrawer}
					onpin={doPin}
					bind:headEl={drawerHead}
				/>
			{/await}
		{/if}
	</div>

	<section class="tables" id="table-{K}" aria-labelledby="tables-{K}">
		<h3 id="tables-{K}">Tables</h3>
		<details open>
			<summary>{network ? 'Edges' : 'Findings'} ({model.edges.length})</summary>
			<div class="tscroll"><EdgeTable {model} {ix} rowVisible={(e) => passFilter(e) && passSearch(e)} onpin={doPin} {mounted} {pinKey} /></div>
		</details>
		<details>
			<summary>Gaps ({model.gaps.length})</summary>
			<div class="tscroll">
				<table class="data gaps">
					<caption>Gaps: pairings looked for and not found. A gap is not a negative result.</caption>
					<thead>
						<tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Status</th><th scope="col">Searched for</th></tr>
					</thead>
					<tbody>
						{#each model.gaps as g (g.id)}
							<tr data-gap-id={g.id} hidden={!showGaps || (hits && !hits.gapSet.has(g.id))}>
								<td>{ix.label(g.source)}</td>
								<td>{ix.label(g.target)}</td>
								<td
									><button type="button" class="linkish gapword" onclick={(ev) => doPin({ type: 'gap', id: g.id }, ev.currentTarget)}
										>No evidence</button
									> <span class="mono small">{g.status}</span></td
								>
								<td>{g.searched_for}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
		<details>
			<summary>{network ? 'Interactions & set aside' : 'Interactions'} ({network ? comboEdges.length + model.setAside.length : model.interactions.length})</summary>
			<div class="tscroll">
				{#if !network}
					<table class="data interactions ia">
						<caption>Interactions: single claims on combined treatments or on one factor changing another's effect. Listed, not pooled.</caption>
						<thead>
							<tr><th scope="col">Claim</th><th scope="col">Direction</th><th scope="col">Quote</th><th scope="col">Paper</th></tr>
						</thead>
						<tbody>
							{#each model.interactions as it (it.edge_id)}
								<tr data-interaction-id={it.edge_id} data-direction={it.direction} hidden={!interactionVisible(it)}>
									<td>
										{#if it.claim}{it.claim.subject} → {it.claim.object}
											<span class="small muted">{it.claim.predicate}{it.claim.negated ? ' (negated)' : ''}</span>{/if}
										<span class="cid">{it.edge_id}</span>
									</td>
									<td><Dir d={it.direction} /></td>
									<td>{#if it.claim}<blockquote>{it.claim.quote}</blockquote>{/if}</td>
									<td class="small">{#if it.claim}{@render paperRef(it.claim.document_id)}{/if}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<table class="data interactions ib">
						<caption>Combination nodes, edges from them, and moderation edges</caption>
						<thead>
							<tr><th scope="col">Item</th><th scope="col">Direction</th><th scope="col">Certainty</th><th scope="col">Studies · claims</th><th scope="col">Open</th></tr>
						</thead>
						<tbody>
							{#each combos as n (n.id)}
								<tr>
									<td><span class="tag">combination</span> {n.label}<br /><span class="small muted">members: {n.members.map(ix.label).join(' + ')}</span></td>
									<td>—</td>
									<td>—</td>
									<td>—</td>
									<td><button type="button" class="open" onclick={(ev) => doPin({ type: 'node', id: n.id }, ev.currentTarget)} aria-label="Open node {n.label}">Open</button></td>
								</tr>
							{/each}
							{#each comboEdges as e (e.id)}
								<tr hidden={!(passFilter(e) && passSearch(e))}>
									<td><span class="tag">{e.kind}</span> {ix.title(e)}</td>
									<td><Dir d={e.direction} /></td>
									<td><Cert c={e.certainty} /><span class="rationale">{e.certainty_rationale}</span></td>
									<td>{e.studies} · {e.claims}</td>
									<td><button type="button" class="open" onclick={(ev) => doPin({ type: 'edge', id: e.id }, ev.currentTarget)} aria-label="Open claims and quotes: {ix.aria(e)}">Open</button></td>
								</tr>
							{/each}
						</tbody>
					</table>
					<table class="data setaside">
						<caption>Set aside: claims left out of every edge, with the reason</caption>
						<thead><tr><th scope="col">Claim id</th><th scope="col">Why</th></tr></thead>
						<tbody>
							{#each model.setAside as s (s.edge_id)}
								<tr>
									<td class="mono">{s.edge_id}</td>
									<td>{s.why} <span class="small muted">(This claim is not in this file's evidence map, so no quote is shown.)</span></td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</details>
		<details ontoggle={(ev) => ev.currentTarget.open && (papersOpen = true)}>
			<summary>Papers ({model.papers.length})</summary>
			<div class="tscroll">
				{#if papersOpen}
					{#await lazyPapers() then { default: PaperTable }}
						<PaperTable {model} {ix} onpin={doPin} {paperVisible} />
					{/await}
				{:else}
					<p class="note">The paper list is drawn when this section opens (it needs JavaScript).</p>
				{/if}
			</div>
		</details>
		<details ontoggle={(ev) => ev.currentTarget.open && loadEvidence()}>
			<summary>Claims ({model.counts.claims})</summary>
			<div class="tscroll">
				{#if evidence}
					{#await lazyClaims() then { default: ClaimTable }}
						<ClaimTable {model} {ix} {evidence} onpin={doPin} {claimVisible} />
					{/await}
				{:else}
					<p class="note">
						{model.counts.claims} claims with their quotes are in
						<a href="data/{K}.json" data-sveltekit-reload>data/{K}.json</a>.
						{#if evState === 'loading'}Loading…{:else if evState === 'error'}It could not be loaded.{:else}
							<button type="button" class="more" onclick={loadEvidence}>Load the claims</button>{/if}
					</p>
				{/if}
			</div>
		</details>
	</section>

	<section class="limits" aria-labelledby="limits-{K}">
		<h3 id="limits-{K}">Limitations</h3>
		<ul>
			{#each model.limitations as l, i (i)}<li>{l}</li>{/each}
		</ul>
	</section>

</div>
