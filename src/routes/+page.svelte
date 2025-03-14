<script lang="ts">
	import testChecker from '$lib/api/testChecker';

	async function _testChecker() {
		const start = performance.now();
		// const results = await testChecker('hallgatok zenet a spotifyon');
		// const results = await testChecker('Részt vetem informatikai, irodalom és matekversenyeken');
		// const results = await testChecker('Vetem egy ujj könyvet a könyves boltban, nagyon teccik');
		// const results = await testChecker('tely');
		// const results = await testChecker('el kaptam a koronavírus fertőzést');
		const results = await testChecker('ami közbejöhet, közbejött');
		const end = performance.now();
		console.debug(results);
		console.debug(results.resultParts.map((part) => part.text).join(''));
		console.debug(`Time taken: ${end - start} milliseconds`);
	}
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<button on:click={_testChecker}>test checker</button>
