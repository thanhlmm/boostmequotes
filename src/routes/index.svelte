<script context="module" lang="ts">
	/**
	 * @type {import('@sveltejs/kit').Load}
	 */
	export async function load({ page, fetch, session, context }) {
		const quotes = await fetch('https://us-central1-boost-me-quotes.cloudfunctions.net/getQuotes', {
			method: 'GET'
		})
			.then((response) => response.json())
			.then((result) => {
				return result.quotes;
			});

		return {
			props: {
				quotes
			}
		};
	}
</script>

<script lang="ts">
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { Functions } from '../lib';
	import { uniq } from 'lodash';
	import Quote from '../components/quote.svelte';

	let topics: string[] = [
		'Age',
		'Alone',
		'Amazing',
		'Anger',
		'Anniversary',
		'Architecture',
		'Art',
		'Attitude',
		'Beauty',
		'Best',
		'Birthday',
		'Brainy',
		'Business',
		'Car',
		'Chance',
		'Change',
		'Christmas',
		'Communication',
		'Computers',
		'Cool',
		'Courage',
		'Dad',
		'Dating',
		'Death',
		'Design',
		'Diet',
		'Dreams',
		'Easter',
		'Education',
		'Environmental',
		'Equality',
		'Experience',
		'Experience',
		'Failure',
		'Faith',
		'Family',
		'Famous',
		"Father's Day",
		'Fear',
		'Finance',
		'Fitness',
		'Food',
		'Forgiveness',
		'Freedom',
		'Friendship',
		'Funny',
		'Future',
		'Gardening',
		'God',
		'Good',
		'Government',
		'Graduation',
		'Great',
		'Happiness',
		'Health',
		'History',
		'Home',
		'Hope',
		'Humor',
		'Imagination',
		'Independence',
		'Inspirational',
		'Intelligence',
		'Jealousy',
		'Jealousy',
		'Knowledge',
		'Leadership',
		'Learning',
		'Legal',
		'Life',
		'Love',
		'Marriage',
		'Medical',
		'Memorial Day',
		'Men',
		'Mom',
		'Money',
		'Morning',
		"Mother's Day",
		'Motivational',
		'Movies',
		'Moving On',
		'Music',
		'Nature',
		"New Year's",
		'Parenting',
		'Patience',
		'Patriotism',
		'Peace',
		'Pet',
		'Poetry',
		'Politics',
		'Positive',
		'Power',
		'Relationship',
		'Religion',
		'Religion',
		'Respect',
		'Romantic',
		'Sad',
		"Saint Patrick's Day",
		'Science',
		'Smile',
		'Society',
		'Space',
		'Sports',
		'Strength',
		'Success',
		'Sympathy',
		'Teacher',
		'Technology',
		'Teen',
		'Thankful',
		'Thanksgiving',
		'Time',
		'Travel',
		'Trust',
		'Truth',
		"Valentine's Day",
		'Veterans Day',
		'War',
		'Wedding',
		'Wisdom',
		'Women',
		'Work'
	];

	const preset: Record<string, typeof topics[number][]> = {
		productive: [
			'Positive',
			'Work',
			'Communication',
			'Inspirational',
			'Amazing',
			'Leadership',
			'Time',
			'Learning',
			'Success'
		],
		motivational: [
			'Positive',
			'Inspirational',
			'Positive',
			'Amazing',
			'Time',
			'Fitness',
			'Knowledge',
			'Life',
			'Future',
			'Wisdom',
			'Smile',
			'Success'
		],
		'enjoy life': [
			'Beauty',
			'Friendship',
			'Courage',
			'Peace',
			'Positive',
			'Thanksgiving',
			'Forgiveness',
			'Health',
			'Humor',
			'Equality',
			'Love',
			'Dating',
			'Smile',
			'Sad',
			'Religion'
		],
		knowledge: [
			'Travel',
			'Learning',
			'Freedom',
			'Experience',
			'Intelligence',
			'Technology',
			'Wisdom',
			'Science',
			'Knowledge',
			'Trust',
			'Business'
		]
	};

	const formValue = writable<ISettings>({
		tag: [],
		time: 'alltimes',
		maxQuotes: 5,
		receivedFromCommunity: true,
		enabled: true
	});
	let isLoading = false;
	let presetTag: Array<keyof typeof preset> = [];
	export let quotes: IQuotes[] = [];
	let quote: IQuotes;
	let quoteImage: IQuoteImage;

	onMount(() => {
		if (browser) {
			const token = window.localStorage.getItem('boostmequote:token');

			if (token) {
				getSettings(token);
			}
		}

		setRandomQuote();
	});

	function getRandomItem<T>(input: T[]): T {
		return input[Math.floor(Math.random() * input.length)];
	}

	function setRandomQuote() {
		const quoteItem = getRandomItem(quotes);
		getImages(quoteItem.tag).then(() => {
			quote = quoteItem;
		});
	}

	function getImages(tag: string[]) {
		return fetch('https://worker.refiapp.workers.dev/randomImage?topics' + tag.join(','), {
			method: 'GET'
		})
			.then((response) => response.json())
			.then((result) => {
				quoteImage = {
					url: result.urls.regular,
					author: result.user.name,
					authorUrl: result.user.portfolio_url
				};
			})
			.catch((error) => console.log('error', error));
	}

	function toggleTag(tag: string) {
		if (presetTag.includes(tag)) {
			presetTag = presetTag.filter((item) => item !== tag);
		} else {
			presetTag = [...presetTag, tag];
		}

		let tags = [];
		presetTag.forEach((item) => {
			console.log({ item });
			const listTags = preset[item] || [];

			tags = [...tags, ...listTags];
		});

		$formValue.tag = uniq(tags);
	}

	function getSettings(token: string) {
		Functions().then((instance) => {
			instance
				.httpsCallable('getSettings')(token)
				.then(({ data }: { data: ISettings | null }) => {
					console.log(data);
					if (data) {
						$formValue = data;
					}
				});
		});
	}

	function handleOnSubmit() {
		saveSetting();
	}

	function saveSetting() {
		isLoading = true;
		Notification.requestPermission()
			.then(() => window.OneSignal.registerForPushNotifications())
			.then(() => window.OneSignal.getUserId())
			.then((uid: string) => {
				$formValue.pushToken = uid;
				$formValue.preset = presetTag;
			})
			.catch((error) => {
				console.log(error);
			})
			.then(() => Functions())
			.then((instance) => {
				return instance
					.httpsCallable('saveSettings')($formValue)
					.then(() => {
						new Notification('Setup complete 🚀', { body: 'Ready to boost you up' });
					});
			})
			.then(() => {
				// Save user tags
				return window.OneSignal.sendTag($formValue.tag);
			})
			.finally(() => {
				isLoading = false;
			});
	}
</script>

<div class="max-w-5xl m-auto relative">
	<!-- Hero section -->
	<div class="flex flex-col md:flex-row md:items-center p-6 mt-4">
		<div>
			<h1 class="text-4xl font-medium mb-2">Boost me Quotes 😼</h1>
			<p class="text-gray-500 max-w-md text-lg">
				Get your 💩 done by showing inspirational quotes randomly.
				<br />
				Gain your energy back.
			</p>
		</div>
		<div class="w-full md:w-2/3 md:pl-4">
			<img src="./hero.svg" alt="hero" />
		</div>
	</div>

	<!-- Quotes section -->
	<div class="mt-4">
		<Quote  quote={quote} quoteImage={quoteImage} enableRandom on:randomQuote={setRandomQuote} />
	</div>

	<!-- Settings -->
	<form class="mt-4" on:submit|preventDefault={handleOnSubmit}>
		<div class="p-6 card bordered space-y-6">
			<div>
				<h2 class="card-title">Pick your interested topics</h2>
				<!-- Make JIT not purge btn-outline -->
				<button class="btn btn-primary btn-outline hidden" />
				<div class="space-x-4">
					{#each Object.keys(preset) as item}
						<button
							class="btn btn-primary capitalize"
							class:btn-outline={!presetTag.includes(item)}
							on:click|preventDefault={() => toggleTag(item)}>{item}</button
						>
					{/each}
					<button
						class="btn btn-secondary"
						class:btn-outline={!presetTag.includes('customize')}
						on:click|preventDefault={() => toggleTag('customize')}>Customize...</button
					>
				</div>

				<div
					class="collapse collapse-arrow mt-6"
					class:collapse-open={presetTag.includes('customize')}
				>
					<!-- <input type="checkbox" />
					<div class="collapse-title text-xl font-medium !bg-transparent m-auto">
						Let me customize
					</div> -->
					<div class="collapse-content p-0 !bg-transparent">
						<div class="grid grid-cols-2 md:grid-cols-4">
							{#each topics as topic}
								<div class="form-control flex-row">
									<!-- svelte-ignore a11y-label-has-associated-control -->
									<label class="cursor-pointer label space-x-4">
										<div>
											<input
												type="checkbox"
												name="tag"
												bind:group={$formValue.tag}
												value={topic}
												checked={true}
												class="radio checkbox checkbox-secondary"
											/>
											<span class="checkbox-mark" />
										</div>
										<span class="label-text capitalize">{topic}</span>
									</label>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
			<hr />
			<div>
				<h2 class="card-title">Settings</h2>

				<div class="space-y-2 max-w-xs m-auto">
					<div class="form-control">
						<label class="label">
							<span class="label-text">Boost me when</span>
						</label>
						<select
							class="select select-bordered select-accent w-full"
							bind:value={$formValue.time}
						>
							<option value="workday">Working hour</option>
							<option value="weekend">Weekend</option>
							<option value="alltimes">All the times</option>
						</select>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text">Max quotes per day</span>
						</label>
						<input
							type="number"
							placeholder="5"
							bind:value={$formValue.maxQuotes}
							class="input input-primary input-bordered"
						/>
					</div>

					<div class="form-control">
						<label class="cursor-pointer label">
							<span class="label-text">Receive quotes from community</span>
							<div>
								<input
									type="checkbox"
									bind:checked={$formValue.receivedFromCommunity}
									class="toggle toggle-secondary"
								/>
								<span class="toggle-mark" />
							</div>
						</label>
					</div>

					<div>
						{#if !$formValue.pushToken}
							<p class="text-gray-500 mb-2">Please wait while we setting up the notification</p>
						{/if}
						<button class="btn btn-primary" class:loading={isLoading} type="submit">
							Boost me 🚀
						</button>
					</div>
				</div>
			</div>
		</div>
	</form>
</div>
