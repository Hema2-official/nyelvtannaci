<script lang="ts">
	import scrapeMTA from '$lib/api/scrapeMTA';

	async function testHelyesEIgy() {
		const start = performance.now();
		const results = await scrapeMTA('helyesEIgy', 'kora');
		const end = performance.now();
		console.debug(results);
		console.debug(`Time taken: ${end - start} milliseconds`);
	}

	async function testKulonVagyEgybe() {
		const start = performance.now();
		const results = await scrapeMTA('kulonVagyEgybe', 'tartósító szer mentes');
		const end = performance.now();
		console.debug(results);
		console.debug(`Time taken: ${end - start} milliseconds`);
	}

	async function testElvalasztas() {
		const start = performance.now();
		const results = await scrapeMTA('elvalasztas', 'elválasztás');
		const end = performance.now();
		console.debug(results);
		console.debug(`Time taken: ${end - start} milliseconds`);
	}
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<button on:click={testHelyesEIgy}>test helyesEIgy</button><br />
<button on:click={testKulonVagyEgybe}>test kulonVagyEgybe</button><br />
<button on:click={testElvalasztas}>test elvalasztas</button>
