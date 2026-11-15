import { buildModel } from '../lib/server/model.js';

// Runs once, at build time (prerender). The returned model is rendered into the
// static HTML and serialised once for hydration. Claim quotes are not in it:
// they live in data/<panel>.json and load only when the reader asks for them.
export function load() {
	return buildModel();
}
