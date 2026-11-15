<script>
	// One claim (L5): subject → predicate → object, its own direction and grade, the quote.
	import Dir from './Dir.svelte';
	import Cert from './Cert.svelte';
	let { id, c } = $props();
</script>

<article class="claim">
	<p class="spo">
		<span class="s">{c.subject}</span>
		<span class="p">→ {c.predicate}{#if c.negated}<span class="tag">negated</span>{/if} →</span>
		<span class="o">{c.object}</span>
	</p>
	<p class="cmeta">
		<Dir d={c.direction} />
		<span class="sep">·</span> <span class="k">grade</span> <Cert c={c.certainty_grade} />
		{#if c.evidence_types?.length}<span class="sep">·</span> {c.evidence_types.join(', ')}{/if}
		{#if c.comparator}<span class="sep">·</span> <span class="k">comparator</span> {c.comparator}{/if}
	</p>
	<blockquote>{c.quote}</blockquote>
	<p class="cid">{id}</p>
</article>
