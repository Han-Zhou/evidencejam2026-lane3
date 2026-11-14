import { error } from '@sveltejs/kit';
import { evidenceFile } from '../../../lib/server/model.js';

export const prerender = true;

export function entries() {
	return [{ panel: 'findings' }, { panel: 'network' }];
}

export function GET({ params }) {
	const body = evidenceFile(params.panel);
	if (!body) error(404, 'unknown panel');
	return new Response(JSON.stringify(body), {
		headers: { 'content-type': 'application/json; charset=utf-8' }
	});
}
