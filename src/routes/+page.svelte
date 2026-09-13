<script lang="ts">
	import check from '$lib/api/check';
	import { Label } from '$lib/components/ui/label';
	import Analysis from '$lib/layout/Analysis.svelte';
	import type { Result, SuccessfulResult } from '$lib/llm/promptConfig';
	import type { IntermediateSummary } from '$lib/llm/toolSummary.type';
	import { parseServerSentEvents } from 'parse-sse';
	import { resource, watch } from 'runed';
	import { fly } from 'svelte/transition';
	import ResultDisplay from '$lib/layout/ResultDisplay.svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import InputSection from '$lib/layout/InputSection.svelte';
	import WelcomeDialog from '$lib/layout/WelcomeDialog.svelte';
	import { cn } from '$lib/utils/shadcn';
	import { viewState } from '$lib/states/ViewState.svelte';
	import { historyDb } from '$lib/utils/history.svelte';
	import { errorMessage } from '$lib/utils/errorMessage';
	import { TriangleAlertIcon } from '@lucide/svelte';
	import * as Alert from '$lib/components/ui/alert';

	// Tailwind 'lg:' matching breakpoint
	const isDesktop = new MediaQuery('(min-width: 64rem)');

	const checkResource = resource(
		[],
		async (_, __, { signal }) => {
			viewState.clearSession();
			const input = $state.snapshot(viewState.currentInput);
			const response = await check(input, { signal });

			for await (const event of parseServerSentEvents(response)) {
				if (event.type === 'init') {
					viewState.showAnalysis = true;
				} else if (event.type === 'intermediate') {
					const summaries = JSON.parse(event.data) as IntermediateSummary[];
					viewState.appendSummaries(summaries);
				} else if (event.type === 'result') {
					const result = JSON.parse(event.data) as Result;
					if (result.error) throw new Error(result.error);
					const successfulResult = result as SuccessfulResult;
					const intermediateSummaries = $state.snapshot(viewState.intermediateSummaries);
					historyDb.addEntry(input, successfulResult, intermediateSummaries);
					return successfulResult;
				} else if (event.type === 'error') {
					throw new Error(JSON.parse(event.data));
				}
			}
		},
		{ lazy: true }
	);

	// Move result to ViewState for central management
	watch([() => checkResource.current], () => {
		viewState.currentResult = checkResource.current ?? null;
	});
</script>

<svelte:head>
	<title>Helyesírás-ellenőrző</title>
	<meta
		name="description"
		content="Magyar szövegrészletek helyesírásának automatikus ellenőrzése."
	/>
</svelte:head>

<div
	class="flex w-full flex-col justify-center p-12 transition-[gap] duration-400 lg:flex-row
		{viewState.showAnalysis ? 'gap-8' : 'gap-0'}"
>
	<div
		class={cn(`flex flex-1 flex-col transition-all duration-400
			${viewState.showAnalysis ? (checkResource.loading ? 'lg:flex-3' : 'lg:flex-4') : ''}`)}
	>
		<InputSection {checkResource} />

		{#if checkResource.error && !checkResource.loading}
			<Alert.Root variant="destructive" class="mt-4">
				<TriangleAlertIcon />
				<Alert.Title>Valami félrement az ellenőrzés során.</Alert.Title>
				<Alert.Description>
					<p>{errorMessage(checkResource.error, 'Ismeretlen hiba történt. Próbáld újra.')}</p>
				</Alert.Description>
			</Alert.Root>
		{:else if viewState.currentResult && !checkResource.loading}
			<ResultDisplay result={viewState.currentResult} {isDesktop} />
		{/if}
	</div>

	<div
		class={cn(`flex flex-1 overflow-visible! transition-all duration-400
			${viewState.showAnalysis ? (checkResource.loading ? 'lg:flex-4' : 'lg:flex-3') : 'flex-0'}`)}
	>
		{#if viewState.showAnalysis}
			<div class="flex w-full flex-col gap-2" in:fly={{ delay: 100, x: 40 }}>
				<Label class="text-lg text-muted-foreground">Források</Label>
				<Analysis summaries={viewState.intermediateSummaries} loading={checkResource.loading} />
			</div>
		{/if}
	</div>
</div>

<WelcomeDialog />
