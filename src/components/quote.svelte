<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import * as htmlToImage from 'html-to-image';
	import { saveAs } from 'file-saver';

	export let enableRandom = false;
	export let quote: IQuotes;
	export let quoteImage: IQuoteImage;
	let imageRef: HTMLElement;
	let isExporting;

	const dispatch = createEventDispatcher();

	function setRandomQuote() {
		dispatch('randomQuote');
	}

	function downloadImage() {
		isExporting = true;
		htmlToImage
			.toBlob(imageRef, {
				filter: (node) => {
					return node.tagName !== 'BUTTON';
				}
			})
			.then(function (blob) {
				saveAs(blob, `${quote.author}_quote.png`);
			})
			.catch((error) => {
				console.log(error);
			})
			.finally(() => {
				isExporting = false;
			});
	}
</script>

<div
	class="card shadow-xl image-full p-2 md:p-0"
	class:exporting={isExporting}
	bind:this={imageRef}
	id="quote-card"
>
	<figure style="height: 400px;">
		<img src={quoteImage?.url || 'https://picsum.photos/id/1005/400/250'} alt="Quotes images" />
	</figure>
	<div class="justify-end card-body">
		<button
			class="px-2 py-1 rounded text-sm absolute right-2 top-2 border border-transparent hover:border-gray-100 group transition-all"
			on:click|preventDefault={downloadImage}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5 inline-block"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
				/>
			</svg>
		</button>
		{#if quote}
			<h2 class="card-title">— {quote.author}</h2>
			<p class="text-lg">{quote.body.replaceAll('%2C', '')}</p>
			<div class="card-actions">
				{#if enableRandom}
					<button class="btn btn-primary btn-outline mt-2" on:click|preventDefault={setRandomQuote}
						>Random quote</button
					>
				{/if}
			</div>
		{/if}
		{#if quoteImage}
			<div class="text-sm mt-2 opacity-80">
				Photo by <a
					href={`${quoteImage.authorUrl}?utm_source=boost_me_quotes&utm_medium=referral`}
					class="underline"
					target="_blank">{quoteImage.author}</a
				>
				on
				<a
					href="https://unsplash.com/?utm_source=boost_me_quotes&utm_medium=referral"
					class="underline"
					target="_blank">Unsplash</a
				>
			</div>
		{/if}
	</div>
</div>

<style>
	.exporting {
		border-radius: 0 !important;
	}

	.exporting::before {
		border-radius: 0 !important;
	}
</style>
