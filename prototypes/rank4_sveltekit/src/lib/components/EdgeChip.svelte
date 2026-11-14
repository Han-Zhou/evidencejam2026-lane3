<script>
	// Always-visible edge chip: direction glyph + certainty dots (filled of 4).
	// It carries the item id; the pooled data-* values sit on the table rows.
	import { CERT_DOTS, dirGlyph } from '../format.js';
	let { e, aria, network, key, cls = '' } = $props();
	const n = $derived(CERT_DOTS[e.certainty] ?? 0);
</script>

<g
	class="chip dir-{e.direction} {cls}"
	transform="translate({e.geom.chip.x},{e.geom.chip.y})"
	tabindex="0"
	role="button"
	aria-label={aria}
	data-k="edge:{e.id}"
	data-edge-id={network ? e.id : undefined}
	data-finding-id={network ? undefined : e.id}
>
	<rect x="-30" y="-11" width="60" height="22" rx="11" />
	<text class="glyph" x="-16" y="5" text-anchor="middle">{dirGlyph(e.direction)}</text>
	<use href="#{key}-dots-{n}" />
</g>
