<script>
	// L0: question and the two panel cards (a tab list). The URL hash records the
	// open panel and the pinned item: #findings, #network/edge/site_preparation->growth
	import { onMount, tick } from 'svelte';
	import Panel from '../lib/components/Panel.svelte';
	import { plural } from '../lib/format.js';

	let { data } = $props();

	const panels = $derived([
		{
			m: data.A,
			line: 'Each planting-stock trait or site factor against seedling survival and growth',
			counts: [
				`${plural(data.A.edges.length, 'finding', 'findings')} · ${plural(data.A.gaps.length, 'gap', 'gaps')}`,
				`${plural(data.A.counts.claims, 'claim', 'claims')} · ${plural(data.A.papers.length, 'paper', 'papers')}`
			]
		},
		{
			m: data.B,
			line: 'The same question as a network: treatments, the conditions they change, and outcomes',
			counts: [
				`${plural(data.B.nodes.length, 'node', 'nodes')} · ${plural(data.B.edges.length, 'edge', 'edges')} · ${plural(data.B.gaps.length, 'gap', 'gaps')}`,
				`${plural(data.B.counts.claims, 'claim', 'claims')} · ${plural(data.B.papers.length, 'paper', 'papers')}`
			]
		}
	]);
	const KEYS = ['findings', 'network'];

	// theme: data-theme on <html> (set before paint by app.html) or the system setting
	let dark = $state(false);
	function toggleTheme() {
		const next = dark ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', next);
		try {
			localStorage.setItem('q1-theme', next);
		} catch {
			/* storage blocked: the choice lasts for this page view */
		}
		dark = !dark;
	}

	let open = $state('findings');
	let pins = $state({ findings: null, network: null });
	let mounted = $state(false);

	function parseHash() {
		let h = location.hash.slice(1);
		try {
			h = decodeURIComponent(h);
		} catch {
			/* keep raw */
		}
		const m = /^(findings|network)(?:\/(edge|node|gap|paper|claim)\/(.+))?$/.exec(h);
		if (!m) return false;
		open = m[1];
		pins[m[1]] = m[2] ? { type: m[2], id: m[3] } : null;
		return !!m[2];
	}

	onMount(() => {
		const mq = matchMedia('(prefers-color-scheme: dark)');
		const readTheme = () => {
			const t = document.documentElement.getAttribute('data-theme');
			dark = t ? t === 'dark' : mq.matches;
		};
		readTheme();
		mq.addEventListener('change', readTheme);
		const pinned = parseHash();
		mounted = true;
		if (pinned)
			tick().then(() => document.getElementById(`graph-${open}`)?.scrollIntoView({ block: 'start' }));
		const onHash = () => parseHash();
		const onKey = (ev) => {
			if (ev.key !== '/' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
			const t = ev.target;
			if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
			ev.preventDefault();
			document.getElementById(`search-${open}`)?.focus();
		};
		addEventListener('hashchange', onHash);
		addEventListener('keydown', onKey);
		return () => {
			mq.removeEventListener('change', readTheme);
			removeEventListener('hashchange', onHash);
			removeEventListener('keydown', onKey);
		};
	});

	$effect(() => {
		if (!mounted) return;
		document.documentElement.setAttribute('data-open', open);
		const p = pins[open];
		const h = `#${open}${p ? `/${p.type}/${p.id}` : ''}`;
		if (decodeURIComponent(location.hash) !== h) history.replaceState(history.state, '', h);
	});

	function select(k, focus = false) {
		open = k;
		if (focus) tick().then(() => document.getElementById(`tab-${k}`)?.focus());
	}
	function tabKey(ev, i) {
		let j = null;
		if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') j = (i + 1) % KEYS.length;
		else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') j = (i + KEYS.length - 1) % KEYS.length;
		else if (ev.key === 'Home') j = 0;
		else if (ev.key === 'End') j = KEYS.length - 1;
		if (j == null) return;
		ev.preventDefault();
		select(KEYS[j], true);
	}
</script>

<svelte:head>
	<title>Q1 · Tree planting in Canadian forest restoration</title>
</svelte:head>

<a class="skip" href="#main">Skip to content</a>

<header class="site-head">
	<div class="topbar">
		<div class="wrap topbar-in">
			<p class="brand">Evidence Jam 2026 · Lane 3 · Decision support</p>
			<button
				type="button"
				class="theme-toggle"
				aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
				aria-pressed={dark}
				onclick={toggleTheme}
			>
				<svg class="i-moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
					><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg
				>
				<svg class="i-sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
					><circle cx="12" cy="12" r="4" /><path
						d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"
					/></svg
				>
			</button>
		</div>
	</div>
	<div class="wrap">
		<h1>Q1 · Tree planting in Canadian forest restoration</h1>
		<p class="question">{data.question}</p>
		<nav aria-label="Panels">
			<div class="cards" role="tablist" aria-label="Answer panels">
				{#each panels as p, i (p.m.key)}
					<button
						type="button"
						role="tab"
						id="tab-{p.m.key}"
						class="card"
						aria-selected={open === p.m.key}
						aria-controls="panel-{p.m.key}"
						tabindex={open === p.m.key ? 0 : -1}
						onclick={() => select(p.m.key)}
						onkeydown={(ev) => tabKey(ev, i)}
					>
						<span class="card-name">{p.m.name}</span>
						<span class="card-line">{p.line}</span>
						{#each p.counts as c (c)}<span class="card-count">{c}</span>{/each}
					</button>
				{/each}
			</div>
		</nav>
	</div>
</header>

<main id="main" class="wrap" tabindex="-1">
	{#each panels as p (p.m.key)}
		<Panel
			model={p.m}
			active={!mounted || open === p.m.key}
			{mounted}
			pin={pins[p.m.key]}
			onpin={(item) => (pins[p.m.key] = item)}
		/>
	{/each}
</main>

<footer class="site-foot">
	<div class="wrap">
		<p>
			Every direction, certainty grade, rationale, count, label and quote on this page is copied from
			<span class="mono">answers/q1_tree_planting.json</span> (Findings) or
			<span class="mono">answers/q1_tree_planting_graph.json</span> (Network). No text on this page was written by a language model.
		</p>
		<p class="small muted">Prototype rank 4: SvelteKit (prerendered) with D3 modules. Works offline; the only external links are DOIs.</p>
	</div>
</footer>
