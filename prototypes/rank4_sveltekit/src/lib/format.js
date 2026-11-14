// Fixed 1:1 display maps (SPEC 1.4) and small mechanical templates (SPEC 1.3c).
// Shared by the build (server) and the client.

export const DIRS = ['increase', 'decrease', 'mixed', 'no_effect', 'unclear'];

export const DIR_WORD = {
	increase: 'Increase',
	decrease: 'Decrease',
	mixed: 'Mixed (studies disagree)',
	no_effect: 'No effect (tested)',
	unclear: 'Unclear'
};

export const DIR_GLYPH = {
	increase: '↑',
	decrease: '↓',
	mixed: '↕',
	no_effect: '=',
	unclear: '?'
};

export const CERTS = ['very_low', 'low', 'moderate', 'high'];

export const CERT_WORD = {
	very_low: 'Very low',
	low: 'Low',
	moderate: 'Moderate',
	high: 'High'
};

export const CERT_DOTS = { very_low: 1, low: 2, moderate: 3, high: 4 };

export const dirWord = (d) => DIR_WORD[d] ?? d;
export const dirGlyph = (d) => DIR_GLYPH[d] ?? '?';
export const certWord = (c) => CERT_WORD[c] ?? c;
export const certRank = (c) => CERTS.indexOf(c);
export const dotsText = (c) => {
	const n = CERT_DOTS[c] ?? 0;
	return '●'.repeat(n) + '○'.repeat(4 - n);
};

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** study_directions in a fixed order, as [direction, count] pairs */
export function orderedCounts(obj) {
	if (!obj) return [];
	const keys = Object.keys(obj).sort((a, b) => {
		const ia = DIRS.indexOf(a);
		const ib = DIRS.indexOf(b);
		return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
	});
	return keys.map((k) => [k, obj[k]]);
}

export const countsText = (obj) =>
	orderedCounts(obj)
		.map(([d, n]) => `${dirWord(d)} ${n}`)
		.join(', ');

/** "From → To: direction, certainty X, N studies, M claims" (SPEC 1.3c) */
export function edgeSentence(e, from, to) {
	return `${from} to ${to}: ${dirWord(e.direction)}, certainty ${certWord(e.certainty)}, ${plural(
		e.studies,
		'study',
		'studies'
	)}, ${plural(e.claims, 'claim', 'claims')}`;
}

export const doiUrl = (doi) => `https://doi.org/${doi}`;
