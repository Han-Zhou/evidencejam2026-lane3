<script>
	// study_directions with the numbers printed (not colour only); the bar is optional
	import { orderedCounts, dirGlyph, countsText } from '../format.js';
	let { counts, label = 'Study directions', bar = true } = $props();
	const pairs = $derived(orderedCounts(counts));
</script>

<span class="sbar" role="img" aria-label="{label}: {countsText(counts)}">
	{#if bar}<span class="sbar-track" aria-hidden="true">
			{#each pairs as [d, n] (d)}<span class="sb-seg bg-{d}" style="flex-grow:{n}"></span>{/each}
		</span>{/if}
	<span class="sbar-nums" aria-hidden="true">
		{#each pairs as [d, n] (d)}<span class="num dir-{d}">{dirGlyph(d)}{n}</span>{/each}
	</span>
</span>
