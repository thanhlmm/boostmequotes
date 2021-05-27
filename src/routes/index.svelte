<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { writable } from 'svelte/store';

	let topics = ['time', 'goal', 'productive', 'love', 'life', 'fact', 'funny'];
	const formValue = writable<ISettings>({
		tag: [],
		time: 'alltimes',
		maxQuotes: 5,
		receivedFromCommunity: true
	});
	const channel = new BroadcastChannel('boostmequotes');

	channel.onmessage = ((ev: MessageEvent<IMessage>) => {
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
	});

	onMount(() => {
		getFMToken();
		getSettings();
		// TODO: Get form value from local state and save it
	});

	onDestroy(() => {
		channel.close();
	});

	function getSettings () {
		channel.postMessage({
			name: 'getSettings'
		})
	}

	function getSettingsReply (data: ISettings | null) {
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
				new Notification('Hi there! This is live', payload);
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
		console.log($formValue);
		channel.postMessage({
			name: 'saveSettings',
			args: $formValue
		})
	}
</script>

<!-- <h1 class="font-normal text-lg">Welcome to Boost me Quotes 👋</h1> -->

<div class="max-w-5xl m-auto">
	<form on:submit|preventDefault={handleOnSubmit}>
		<div class="p-6 card bordered space-y-6 divide-y">
			<div>
				<h2 class="card-title">Pick your interested topics</h2>
				<div class="grid grid-cols-2 md:grid-cols-3">
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
						<button class="btn btn-primary" type="submit">Boost me</button>
					</div>
				</div>
			</div>
		</div>
	</form>
</div>
