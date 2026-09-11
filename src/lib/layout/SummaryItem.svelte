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

	const FUNCTION_NAMES: Record<AvailableFunctionName, string> = {
		kulon_vagy_egybe: 'Külön vagy egybe?',
		'helyes-e_igy': 'Helyes-e így?',
		elvalasztas: 'Elválasztás',
		nevkereso: 'Névkereső',
		datumok: 'Dátumok',
		szamok: 'Számok'
	};

	let correctnessClass = $derived(summary?.correct ? 'text-correct' : 'text-incorrect');
</script>

<!-- Loading spinner to tool icon transition -->
{#snippet MediaIcon()}
	{#if summary}
		{@const FunctionIcon = FUNCTION_ICONS[summary.tool]}
		<div class="flex items-center justify-center" in:fly={{ x: 12, duration: 200 }}>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<FunctionIcon class="size-6 text-muted-foreground" />
				</Tooltip.Trigger>
				<Tooltip.Content>
					<p>{FUNCTION_NAMES[summary.tool]}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</div>
	{:else}
		<div class="flex items-center justify-center" out:fly={{ x: -12, duration: 200 }}>
			<Spinner class="size-6 text-muted-foreground opacity-80" />
		</div>
	{/if}
{/snippet}

<div class="flex w-full" in:fly={{ y: -10 }}>
	<Item.Root size="sm">
		<Item.Media>
			{@render MediaIcon()}
		</Item.Media>
		{#if summary}
			<Item.Content class="gap-1">
				<Item.Title class="block {summary.correct === undefined ? '' : correctnessClass}">
					{#if summary.query && summary.query !== summary.expression}
						{summary.query} <ArrowRightIcon class="inline-block size-4 shrink-0 align-middle" />
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
