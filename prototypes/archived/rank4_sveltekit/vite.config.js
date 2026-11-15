import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter({ pages: 'build', assets: 'build', strict: true }),
			// relative asset paths: the site works from any folder served by python -m http.server
			paths: { relative: true },
			// fixed version name: the same input gives the same output files
			version: { name: 'q1-rank4', pollInterval: 0 },
			output: { bundleStrategy: 'split' },
			inlineStyleThreshold: 0
		})
	],
	build: {
		sourcemap: false,
		reportCompressedSize: false
	}
});
