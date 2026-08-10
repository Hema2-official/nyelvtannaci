<script lang="ts">
	import { errorMessage } from '$lib/utils/errorMessage';
	import type { IntermediateSummary } from '$lib/UI/toolSummary.type';
	import check from '$lib/api/check';
	import type { Result } from '$lib/llm/promptConfig';
	import { parseServerSentEvents } from 'parse-sse';

	let intermediateSummaries = $state<IntermediateSummary[]>([]);
	let result = $state<Result | null>(null);
	let error = $state<string | null>(null);
	let checking = $state(false);

	// const input = 'hallgatok zenet a spotifyon';
	const input = 'Részt vetem informatikai, irodalom és matekversenyeken';
	// const input = 'Vetem egy ujj könyvet a könyves boltban, nagyon teccik';
	// const input = 'tely';
	// const input = 'el kaptam a koronavírus fertőzést';
	// const input = 'ami közbejöhet, közbejött';

	async function _testChecker() {
		checking = true;
		intermediateSummaries = [];
		result = null;
		error = null;

		const start = performance.now();

		try {
			const response = await check(input);

			for await (const event of parseServerSentEvents(response)) {
				if (event.type === 'intermediate') {
					const summaries = JSON.parse(event.data) as IntermediateSummary[];
					intermediateSummaries = [...intermediateSummaries, ...summaries];
				} else if (event.type === 'result') {
					result = JSON.parse(event.data);
				} else if (event.type === 'error') {
					error = JSON.parse(event.data);
				}
			}
		} catch (e: unknown) {
			console.error(e);
			error = errorMessage(e);
		} finally {
			checking = false;
			const end = performance.now();
			console.debug(`Time taken: ${end - start} milliseconds`);
		}
	}
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<button onclick={_testChecker} disabled={checking}>
	{checking ? 'Checking...' : 'test checker'}
</button>

{#if error}
	<p style="color: red;">Error: {error}</p>
{/if}

<h2>Intermediate Messages</h2>
<ul>
	{#each intermediateSummaries as summary, index}
		<li>
			<strong>[{index + 1}] {summary.expression}</strong> -
			{#if summary.correct}
				<span style="color: green;">Correct</span>
			{:else}
				<span style="color: red;">Incorrect</span>
			{/if}
			{#if summary.explanation}
				: {summary.explanation}
			{/if}
			{#if summary.shareLink}
				(<a href={summary.shareLink} target="_blank" rel="noreferrer">link</a>)
			{/if}
		</li>
	{:else}
		<li>No intermediate messages received yet.</li>
	{/each}
</ul>

{#if result}
	<h2>Final Result</h2>
	<pre>{JSON.stringify(result, null, 2)}</pre>
{/if}
