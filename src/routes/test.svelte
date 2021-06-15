<script>
	// Logic code here
	let name = 'thanh';

	const changeName = () => {
		name = 'Binh';
	};
</script>

<div class="p-3 bg-red-400">
	Hello world {name}
	<hr />
	<button on:click={changeName}>change name</button>
</div>
