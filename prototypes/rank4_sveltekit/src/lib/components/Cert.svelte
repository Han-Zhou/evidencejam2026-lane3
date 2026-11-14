<script>
	import { certWord, dotsText } from '../format.js';
	let { c } = $props();
</script>

<span class="cert"><span class="dots" aria-hidden="true">{dotsText(c)}</span> {certWord(c)}</span>
