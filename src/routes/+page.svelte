<script lang="ts">
	import check from '$lib/api/check';
	import { Label } from '$lib/components/ui/label';
	import Analysis from '$lib/layout/Analysis.svelte';
	import type { Result, SuccessfulResult } from '$lib/llm/promptConfig';
	import type { IntermediateSummary } from '$lib/llm/toolSummary.type';
	import { parseServerSentEvents } from 'parse-sse';
	import { resource } from 'runed';
	import { fade } from 'svelte/transition';
	import ResultDisplay from '$lib/layout/ResultDisplay.svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import InputSection from '$lib/layout/InputSection.svelte';
	import { cn } from '$lib/utils/shadcn';

	let input = $state('');
	let showAnalysis = $state(false);
	let intermediateSummaries: IntermediateSummary[] = $state([]);

	// Tailwind 'lg:' matching breakpoint
	const isDesktop = new MediaQuery('(min-width: 64rem)');

	const checkResource = resource(
		[],
		async (_, __, { signal }) => {
			intermediateSummaries = [];
			const response = await check(input, { signal });

			for await (const event of parseServerSentEvents(response)) {
				if (event.type === 'init') {
					showAnalysis = true;
				} else if (event.type === 'intermediate') {
					const summaries = JSON.parse(event.data) as IntermediateSummary[];
					intermediateSummaries = [...intermediateSummaries, ...summaries];
				} else if (event.type === 'result') {
					const result = JSON.parse(event.data) as Result;
					if (result.error) throw new Error(result.error);
					return result as SuccessfulResult;
				} else if (event.type === 'error') {
					throw new Error(JSON.parse(event.data));
				}
			}
		},
		{ lazy: true }
	);
</script>

<div
	class="flex w-full flex-col justify-center p-12 transition-[gap] duration-400 lg:flex-row
		{showAnalysis ? 'gap-8' : 'gap-0'}"
>
	<div
		class={cn(`flex flex-1 flex-col transition-all duration-400
			${showAnalysis ? (checkResource.loading ? 'lg:flex-3' : 'lg:flex-4') : ''}`)}
	>
		<InputSection bind:input {checkResource} />

		{#if checkResource.current && !checkResource.loading}
			<ResultDisplay result={checkResource.current} {isDesktop} />
		{/if}
	</div>

	<div
		class={cn(`flex flex-1 overflow-visible! transition-all duration-400
			${showAnalysis ? (checkResource.loading ? 'lg:flex-4' : 'lg:flex-3') : 'flex-0'}`)}
	>
		{#if showAnalysis}
			<div class="flex w-full flex-col gap-2" in:fade>
				<Label class="text-lg text-muted-foreground">Elemzés</Label>
				<Analysis summaries={intermediateSummaries} loading={checkResource.loading} />
			</div>
		{/if}
	</div>
</div>
