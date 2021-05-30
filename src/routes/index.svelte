<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { writable } from 'svelte/store';

	let topics: string[] = JSON.parse(
		'["Age","Alone","Amazing","Anger","Anniversary","Architecture","Art","Attitude","Beauty","Best","Birthday","Brainy","Business","Car","Chance","Change","Christmas","Communication","Computers","Cool","Courage","Dad","Dating","Death","Design","Diet","Dreams","Easter","Education","Environmental","Equality","Experience","Experience","Failure","Faith","Family","Famous","Father\'s Day","Fear","Finance","Fitness","Food","Forgiveness","Freedom","Friendship","Funny","Future","Gardening","God","Good","Government","Graduation","Great","Happiness","Health","History","Home","Hope","Humor","Imagination","Independence","Inspirational","Intelligence","Jealousy","Jealousy","Knowledge","Leadership","Learning","Legal","Life","Love","Marriage","Medical","Memorial Day","Men","Mom","Money","Morning","Mother\'s Day","Motivational","Movies","Moving On","Music","Nature","New Year\'s","Parenting","Patience","Patriotism","Peace","Pet","Poetry","Politics","Positive","Power","Relationship","Religion","Religion","Respect","Romantic","Sad","Saint Patrick\'s Day","Science","Smile","Society","Space","Sports","Strength","Success","Sympathy","Teacher","Technology","Teen","Thankful","Thanksgiving","Time","Travel","Trust","Truth","Valentine\'s Day","Veterans Day","War","Wedding","Wisdom","Women","Work"]'
	);
	let isInstalledWorker = navigator.serviceWorker.controller?.state === 'activated';

	const formValue = writable<ISettings>({
		tag: [],
		time: 'alltimes',
		maxQuotes: 5,
		receivedFromCommunity: true,
		enabled: true
	});
	const channel = new BroadcastChannel('boostmequotes');

	channel.onmessage = (ev: MessageEvent<IMessage>) => {
		if (ev.data.type !== 'reply') {
			return;
		}

		console.log('Reply msg');
		console.log(ev.data);

		switch (ev.data.name) {
			case 'getSettings':
				getSettingsReply(ev.data.args);
				return;
		}
	};

	onMount(() => {
		getFMToken();
		getSettings();
		navigator.serviceWorker.getRegistration('service-worker.js').then((registration) => {
			console.log(registration);
			if (registration.active) {
				isInstalledWorker = true;
			}

			// TODO: Get service worker and sync to state
			// registration.installing.onstatechange = (event) => {
			// 	if (registration.active) {
			// 		isInstalledWorker = true;
			// 	}
			// };
		});
	});

	onDestroy(() => {
		channel.close();
	});

	function getSettings() {
		channel.postMessage({
			name: 'getSettings'
		});
	}

	function getSettingsReply(data: ISettings | null) {
		console.log(data);
		if (data) {
			$formValue = data;
		}
	}

	async function getFMToken() {
		// Boostrap the token for sending notification
		const { Messaging } = await import('../config');
		Messaging().then(async (instance) => {
			instance.useServiceWorker(await navigator.serviceWorker.getRegistration('service-worker.js'));

			instance.onMessage((payload) => {
				// TODO: Update to right notification
				new Notification('Boost me Quotes', payload);
			});

			instance
				.getToken({
					vapidKey:
						'BJns9OL0QKUPOGVSMxV5kP2BzZx64IYhgtBRxhUYw3KbtskErR5SWME71IxCxbEAUYtfGydLeCd9BrBQ8ThBx0g',
					serviceWorkerRegistration: await navigator.serviceWorker.getRegistration(
						'service-worker.js'
					)
				})
				.then((currentToken) => {
					if (currentToken) {
						console.log(currentToken);
						// Send the token to your server and update the UI if necessary
						// ...
					} else {
						// Show permission request UI
						console.log('No registration token available. Request permission to generate one.');
						// ...
					}
				})
				.catch((err) => {
					console.log('An error occurred while retrieving token. ', err);
					// ...
				});
		});
	}

	function handleOnSubmit() {
		channel.postMessage({
			name: 'saveSettings',
			args: $formValue
		});

		channel.postMessage({
			name: 'boostMe'
		});
	}
</script>

<!-- <h1 class="font-normal text-lg">Welcome to Boost me Quotes 👋</h1> -->

<div class="max-w-5xl m-auto relative">
	<div class="pl-16 md:absolute md:pl-0 left-32 top-1 md:top-2">
		<img class="w-20 h-auto" style="transform:scaleX(-1)" src="./arrow.svg" alt="hero" />
		<p class="md:pl-10 pt-2">Approve to get the quotes</p>
	</div>
	<div class="flex flex-col md:flex-row md:items-center p-6 mt-10 md:mt-36">
		<div>
			<h1 class="text-3xl font-medium mb-2">Boost me Quotes 😼</h1>
			<p class="text-gray-500 max-w-md text-lg">
				Show an inspirational Quotes randomly so you can get back your spirit to get your 💩 done
			</p>
		</div>
		<div class="w-full md:w-2/3 md:pl-4">
			<img src="./hero.svg" alt="hero" />
		</div>
	</div>
	<form on:submit|preventDefault={handleOnSubmit}>
		<div class="p-6 card bordered space-y-6">
			<div>
				<h2 class="card-title">Pick your interested topics</h2>
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

					<!-- <p>
						{JSON.stringify($formValue, 0, 2)}
					</p> -->

					<div>
						{#if !isInstalledWorker}
							<p class="text-gray-500 mb-2">Please wait while we setting up the notification</p>
						{/if}
						<button class="btn btn-primary" type="submit">Boost me 🚀</button>
					</div>
				</div>
			</div>
		</div>
	</form>
</div>
