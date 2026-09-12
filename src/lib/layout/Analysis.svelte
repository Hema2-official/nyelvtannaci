<script lang="ts">
	import type { IntermediateSummary } from '$lib/llm/toolSummary.type';
	import * as Item from '$lib/components/ui/item';
	import SummaryItem from './SummaryItem.svelte';
	import { fly } from 'svelte/transition';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import { ScrollState, watch } from 'runed';
	import * as Tooltip from '$lib/components/ui/tooltip';

	type Props = { summaries: IntermediateSummary[]; loading: boolean };
	let { summaries, loading }: Props = $props();

	let scrollAreaRef: HTMLDivElement | null = $state(null);
	const groupScroll = new ScrollState({ element: () => scrollAreaRef, behavior: 'smooth' });

	watch([() => dedupedSummaries.length, () => scrollAreaRef], () => {
		groupScroll.scrollToBottom();
	});

	function summaryHash(summary: IntermediateSummary | null, index?: number): string {
		if (summary === null) return 'null' + (index ?? '');
		return `${summary.tool}:${summary.expression}:${summary.query}`;
	}

	let dedupedSummaries: IntermediateSummary[] = $derived.by(() => {
		const seen = new Set<string>();
		return summaries.filter((summary) => {
			const key = summaryHash(summary);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	});
</script>

<Tooltip.Provider delayDuration={400}>
	<ScrollArea type="always" class="max-h-[60dvh]" bind:viewportRef={scrollAreaRef}>
		<Item.Group class="gap-0!">
			{#each [...dedupedSummaries, ...(loading ? [null] : [])] as summary, index (summaryHash(summary, index))}
				<SummaryItem {summary} />
				{#if index < dedupedSummaries.length - 1 + (loading ? 1 : 0)}
					<div in:fly={{ y: -4 }}><Item.Separator /></div>
				{/if}
			{/each}
		</Item.Group>
	</ScrollArea>
</Tooltip.Provider>
