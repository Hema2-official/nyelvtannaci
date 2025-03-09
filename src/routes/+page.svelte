<script lang="ts">
	import testChecker from '$lib/api/testChecker';
	import testScraper from '$lib/api/testScraper';

	async function testHelyesEIgy() {
		const start = performance.now();
		const results = await testScraper('helyesEIgy', 'kora');
		const end = performance.now();
		console.debug(results);
		console.debug(`Time taken: ${end - start} milliseconds`);
	}

	async function testKulonVagyEgybe() {
		const start = performance.now();
		const results = await testScraper('kulonVagyEgybe', 'tartósító szer mentes');
		const end = performance.now();
		console.debug(results);
		console.debug(`Time taken: ${end - start} milliseconds`);
	}

	async function testElvalasztas() {
		const start = performance.now();
		const results = await testScraper('elvalasztas', 'elválasztás');
		const end = performance.now();
		console.debug(results);
		console.debug(`Time taken: ${end - start} milliseconds`);
	}

	async function _testChecker() {
		const start = performance.now();
		// const results = await testChecker('Ez egy példa mondat!');
		const results = await testChecker('Ez egy példa mondat.');
		const end = performance.now();
		console.debug(results);
		console.debug(results.resultParts.map((part) => part.text).join(' '));
		console.debug(`Time taken: ${end - start} milliseconds`);
	}
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<button on:click={testHelyesEIgy}>test helyesEIgy</button><br />
<button on:click={testKulonVagyEgybe}>test kulonVagyEgybe</button><br />
<button on:click={testElvalasztas}>test elvalasztas</button><br />
<button on:click={_testChecker}>test checker</button>
