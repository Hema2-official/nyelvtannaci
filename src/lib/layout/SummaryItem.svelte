<script lang="ts">
	import type { IntermediateSummary } from '$lib/llm/toolSummary.type';
	import * as Item from '$lib/components/ui/item';
	import { Button } from '$lib/components/ui/button';
	import {
		ArrowRightIcon,
		BookSearchIcon,
		CalendarDaysIcon,
		CheckCheckIcon,
		ExternalLinkIcon,
		HashIcon,
		ScissorsLineDashedIcon,
		SquareSplitHorizontalIcon
	} from '@lucide/svelte';
	import type { AvailableFunctionName } from '$lib/llm/promptConfig';
	import type { LucideIcon } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import Spinner from '$lib/components/ui/spinner/spinner.svelte';

	type Props = { summary: IntermediateSummary | null };
	let { summary }: Props = $props();

	const FUNCTION_ICONS: Record<AvailableFunctionName, LucideIcon> = {
		kulon_vagy_egybe: SquareSplitHorizontalIcon,
		'helyes-e_igy': CheckCheckIcon,
		elvalasztas: ScissorsLineDashedIcon,
		nevkereso: BookSearchIcon,
		datumok: CalendarDaysIcon,
		szamok: HashIcon
	};

	let correctnessClass = $derived(summary?.correct ? 'text-correct' : 'text-incorrect');
</script>

<!-- Loading spinner to tool icon transition -->
{#snippet MediaIcon()}
	{@const FunctionIcon = summary ? FUNCTION_ICONS[summary.tool] : undefined}
	{#if FunctionIcon}
		<div
			class="col-start-1 row-start-1 flex items-center justify-center"
			in:fly={{ x: 12, duration: 200 }}
		>
			<FunctionIcon class="size-6 text-muted-foreground" />
		</div>
	{:else}
		<div
			class="col-start-1 row-start-1 flex items-center justify-center"
			out:fly={{ x: -12, duration: 200 }}
		>
			<Spinner class="size-6 text-muted-foreground opacity-80" />
		</div>
	{/if}
{/snippet}

<div class="flex w-full" in:fly={{ y: -10 }}>
	<Item.Root size="sm">
		<Item.Media>
			<Tooltip.Root disabled={!summary}>
				<Tooltip.Trigger class="grid grid-cols-1 grid-rows-1 place-items-center">
					{@render MediaIcon()}
				</Tooltip.Trigger>
				<Tooltip.Content>
					<!-- TODO: readable name here -->
					<p>{summary?.tool}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Item.Media>
		{#if summary}
			<Item.Content class="gap-1">
				<Item.Title class={summary.correct === undefined ? '' : correctnessClass}>
					{#if summary.query && summary.query !== summary.expression}
						{summary.query} <ArrowRightIcon class="inline size-4" />
					{/if}
					{summary.expression}
				</Item.Title>
				{#if summary.explanation}
					<Item.Description>{summary.explanation}</Item.Description>
				{/if}
			</Item.Content>
			<Item.Actions>
				{#if summary.shareLink}
					<Button
						href={summary.shareLink}
						target="_blank"
						rel="noopener noreferrer"
						variant="ghost"
						size="icon"
						><ExternalLinkIcon />
					</Button>
				{/if}
			</Item.Actions>
		{/if}
	</Item.Root>
</div>
