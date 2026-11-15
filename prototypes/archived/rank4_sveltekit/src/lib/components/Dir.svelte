<script>
	import { dirGlyph, dirWord } from '../format.js';
	let { d } = $props();
</script>

<span class="dir dir-{d}"><span class="glyph" aria-hidden="true">{dirGlyph(d)}</span> {dirWord(d)}</span>
