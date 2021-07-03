import preprocess from 'svelte-preprocess';
// import adapter from '@sveltejs/adapter-static';
import vercel from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),
	kit: {
		// hydrate the <div id="svelte"> element in src/app.html
		target: '#svelte',
		ssr: true,
		adapter: vercel(),
		// adapter: adapter({
		// 	pages: 'build',
		// 	assets: 'build',
		// 	fallback: null
		// }),
		files: {
			assets: './src/assets'
		}
	},
};

export default config;
