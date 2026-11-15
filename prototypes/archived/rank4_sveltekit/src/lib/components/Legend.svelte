<script>
	// Always-visible legend: explains the encoding (fixed UI copy only).
	import { DIRS, CERTS, dirGlyph, dirWord, certWord, dotsText } from '../format.js';
	let { model } = $props();
	const network = $derived(model.key === 'network');
</script>

<div class="legend" role="group" aria-label="Legend">
	<ul class="lg-row">
		{#each DIRS as d (d)}
			<li>
				<svg class="lg-sw" viewBox="0 0 30 12" aria-hidden="true"><path class="lg-line dir-{d}" d="M1,6H29" /></svg>
				<span class="dir dir-{d}"><span class="glyph" aria-hidden="true">{dirGlyph(d)}</span> {dirWord(d)}</span>
			</li>
		{/each}
	</ul>
	<ul class="lg-row">
		<li class="lg-k">Certainty (dots filled of 4):</li>
		{#each [...CERTS].reverse() as c (c)}
			<li><span class="dots" aria-hidden="true">{dotsText(c)}</span> {certWord(c)}</li>
		{/each}
	</ul>
	<ul class="lg-row">
		<li>
			<svg class="lg-sw" viewBox="0 0 30 12" aria-hidden="true"
				><path class="lg-plain" d="M1,3H29" stroke-width="1.5" /><path class="lg-plain" d="M1,9H29" stroke-width="6" /></svg
			>
			Line width = number of studies
		</li>
		<li>
			<svg class="lg-sw" viewBox="0 0 30 12" aria-hidden="true"
				><path class="lg-plain" d="M1,6H20" stroke-width="2" /><path class="lg-fill" d="M20,1L29,6L20,11z" /></svg
			>
			Arrowhead at the target
		</li>
		<li>
			<svg class="lg-sw" viewBox="0 0 30 12" aria-hidden="true"><path class="lg-gap" d="M1,6H29" /></svg>
			<span class="lg-gapword">No evidence</span> = a gap: no study tested this pairing (not a negative result)
		</li>
		{#if network}
			<li>
				<svg class="lg-sw" viewBox="0 0 30 12" aria-hidden="true"
					><path class="lg-mod" d="M1,6H22" /><path class="lg-fill" d="M25,1L30,6L25,11L20,6z" /></svg
				>
				Moderation: dotted line, ◆ on the chip of the edge whose effect it changes
			</li>
			<li>
				<svg class="lg-sw" viewBox="0 0 30 12" aria-hidden="true"><path class="lg-member" d="M1,6H29" /></svg>
				Member of a combination — not an evidence edge
			</li>
		{/if}
	</ul>
	{#if network}
		<ul class="lg-row">
			<li class="lg-k">Node shapes:</li>
			<li><svg class="lg-node" viewBox="0 0 34 18" aria-hidden="true"><rect x="1" y="1" width="32" height="16" rx="7" /></svg> Planting stock</li>
			<li><svg class="lg-node" viewBox="0 0 34 18" aria-hidden="true"><rect x="1" y="1" width="32" height="16" rx="1.5" /></svg> Site treatment</li>
			<li><svg class="lg-node" viewBox="0 0 34 18" aria-hidden="true"><rect x="1" y="1" width="32" height="16" rx="8" /></svg> Condition</li>
			<li><svg class="lg-node out" viewBox="0 0 34 18" aria-hidden="true"><rect x="1.5" y="1.5" width="31" height="15" rx="4" /></svg> Outcome</li>
		</ul>
	{/if}
	<ul class="lg-row">
		<li class="lg-k">After a click on a node:</li>
		<li>
			<svg class="lg-sw" viewBox="0 0 30 12" aria-hidden="true"
				><path class="lg-halo" d="M1,6H29" /><path class="lg-plain" d="M1,6H29" stroke-width="2" /></svg
			>
			band = one step from the node
		</li>
		{#if network}
			<li>
				<svg class="lg-sw" viewBox="0 0 30 12" aria-hidden="true"
					><path class="lg-plain lg-far" d="M1,6H29" stroke-width="2" /></svg
				>
				pale line = further steps, a separate body of evidence
			</li>
		{/if}
		<li>
			<svg class="lg-sw" viewBox="0 0 30 12" aria-hidden="true"
				><path class="lg-plain lg-faded" d="M1,6H29" stroke-width="2" /></svg
			>
			faint = not on its pathways
		</li>
	</ul>
</div>
