<script context="module" lang="ts">
	/**
	 * @type {import('@sveltejs/kit').Load}
	 */
	export async function load({ page, fetch, session, context }) {
		const quoteImage = await fetch(
			'https://worker.refiapp.workers.dev/randomImage?topics' + decodeURI(page.query.get('tag')),
			{
				method: 'GET'
			}
		)
			.then((response) => response.json())
			.then((result) => {
				return {
					url: result.urls.regular,
					author: result.user.name,
					authorUrl: result.user.portfolio_url
				};
			})
			.catch((error) => console.log('error', error));

		console.log(quoteImage);
		return {
			props: {
				quote: {
					body: decodeURI(page.query.get('body')),
					author: decodeURI(page.query.get('author'))
				},
				quoteImage
			}
		};
	}
</script>

<script lang="ts">
	import Quote from 'src/components/quote.svelte';

	export let quote: IQuotes;
	export let quoteImage: IQuoteImage;
</script>

<div class="max-w-5xl m-auto relative">
	<!-- Quotes section -->
	<Quote quote={quote} quoteImage={quoteImage} />
</div>
