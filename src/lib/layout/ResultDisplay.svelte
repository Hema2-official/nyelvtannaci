<script lang="ts">
	import type { SuccessfulResult } from '$lib/llm/promptConfig';
	import { cn } from '$lib/utils/shadcn';
	import { CheckIcon, WholeWordIcon } from '@lucide/svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import * as HoverCard from '$lib/components/ui/hover-card';
	import * as Drawer from '$lib/components/ui/drawer';
	import { slide } from 'svelte/transition';
	import * as Card from '$lib/components/ui/card';
	import { useDebounce, watch } from 'runed';
	import { Label } from '$lib/components/ui/label';
	import CopyButton from './CopyButton.svelte';

	type Props = { result: SuccessfulResult; isDesktop: MediaQuery };
	let { result, isDesktop }: Props = $props();

	const hasCorrections = $derived(result.resultParts.some((p) => p.type !== 'original'));
	const hasExplanations = $derived(result.resultParts.some((p) => p.explanation));

	type TypeStyle = { label: string; color: string; part: string };
	const TYPE_STYLES: Record<SuccessfulResult['resultParts'][number]['type'], TypeStyle> = {
		original: {
			label: 'Eredeti',
			color: cn('text-original'),
			part: cn('')
		},
		corrected: {
			label: 'Javított',
			color: cn('text-corrected'),
			part: cn('border-b-2 border-corrected/40 bg-corrected/6')
		},
		added: {
			label: 'Hozzáadott',
			color: cn('text-added'),
			part: cn('border-b-2 border-added/50 bg-added/10')
		},
		removed: {
			label: 'Eltávolított',
			color: cn('text-removed'),
			part: cn('border-b-2 border-dashed border-removed/50 bg-removed/10 line-through')
		}
	};

	type ResultPart = SuccessfulResult['resultParts'][number];

	// mobile Drawer state
	let activePart = $state<ResultPart | null>(null);
	let isDrawerOpen = $state(false);

	// desktop HoverCard state
	let hoverAnchorEl = $state<HTMLElement | null>(null);
	let isHoverOpen = $state(false);

	const openHover = useDebounce((target: HTMLElement, part: ResultPart) => {
		hoverAnchorEl = target;
		activePart = part;
		isHoverOpen = true;
	}, 50);

	const closeHover = useDebounce(() => {
		isHoverOpen = false;
	}, 150);

	// Reset state on a new result
	watch([() => result], () => {
		openHover.cancel();
		closeHover.cancel();
		activePart = null;
		hoverAnchorEl = null;
		isHoverOpen = false;
		isDrawerOpen = false;
	});

	function handleMouseEnter(e: MouseEvent, part: ResultPart) {
		if (!isDesktop.current) return;
		closeHover.cancel();
		const target = e.currentTarget as HTMLElement;
		if (isHoverOpen) {
			openHover.cancel();
			hoverAnchorEl = target;
			activePart = part;
		} else {
			openHover(target, part);
		}
	}

	function handleMouseLeave() {
		if (!isDesktop.current) return;
		openHover.cancel();
		closeHover();
	}

	function handlePartClick(part: ResultPart) {
		if (isDesktop.current) return;
		activePart = part;
		isDrawerOpen = true;
	}
</script>

{#snippet ExplanationContent(part: ResultPart)}
	{#if part.explanation}
		<span class="text-sm font-medium text-muted-foreground">Magyarázat</span>
		<p class="text-sm leading-relaxed whitespace-pre-wrap">{part.explanation}</p>
	{/if}

	{#if part.references && part.references.length > 0}
		<div class="space-y-1">
			<p class="text-xs font-medium tracking-wider text-slate-500 uppercase">Hivatkozások</p>
			{#each part.references as ref (ref)}
				<!-- This had a " char and I found it using the „[^”]*$ regex! How cool is that?
				 About two years ago, I didn't even know much about regex. I learnt it while
				 sketching up a parser in C3. -->
				<p class="text-xs text-slate-400 italic">„{ref}”</p>
			{/each}
		</div>
	{/if}
{/snippet}

<!-- Whitespace cancellation and simple elements (instead of components) are used here to avoid
unwanted gaps between parts (to keep the punctuation and whatnot intact). -->
{#snippet TextPartsDisplay()}
	{#each result.resultParts as part, i (i)}
		{@const hasInfo = part.type !== 'original' || !!part.explanation || !!part.references.length}
		{#if !hasInfo}
			<span class="{TYPE_STYLES[part.type].part} {TYPE_STYLES[part.type].color} rounded-sm"
				>{part.text}</span
			>
		{:else}
			<span
				role="button"
				tabindex="0"
				class="{TYPE_STYLES[part.type].part} {TYPE_STYLES[part.type].color}
					group relative cursor-pointer rounded-sm transition-all duration-200 hover:brightness-125 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
				onmouseenter={(e) => handleMouseEnter(e, part)}
				onmouseleave={handleMouseLeave}
				onclick={() => handlePartClick(part)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handlePartClick(part);
					}
				}}>{part.text}</span
			>
		{/if}
	{/each}
{/snippet}

<div class="mt-8 flex w-full flex-col" in:slide={{ axis: 'y' }}>
	{#if hasCorrections}
		<div class="flex items-center justify-between pb-2">
			<Label class="text-lg text-muted-foreground">Javasolt alak</Label>
			<CopyButton {result} />
		</div>
		<Card.Root class="w-full" size="sm">
			<Card.Content class="text-base whitespace-pre-wrap">
				{@render TextPartsDisplay()}
			</Card.Content>

			<!-- Legend -->
			<Card.Footer class="flex flex-wrap gap-4 text-xs text-muted-foreground">
				{#each Object.entries(TYPE_STYLES) as [type, config]}
					{#if result.resultParts.some((p) => p.type === type)}
						<span class="flex items-center gap-1">
							<WholeWordIcon class="size-4 {config.color} opacity-80 saturate-120" />
							{config.label}
						</span>
					{/if}
				{/each}
			</Card.Footer>
		</Card.Root>
	{:else}
		<span class="flex items-center gap-2 text-lg select-none">
			<CheckIcon class="size-6 text-correct" />
			Minden rendben
		</span>

		{#if hasExplanations}
			<Label class="mt-4 text-lg text-muted-foreground">Magyarázat</Label>
			{#each result.resultParts as part}
				{#if part.explanation}
					<p class="mt-2 whitespace-pre-wrap">
						{#if result.resultParts.length > 1}<span>„{part.text}”: </span>{/if}
						{part.explanation}
					</p>
				{/if}
			{/each}
		{/if}
	{/if}
</div>

{#if isDesktop.current}
	<HoverCard.Root bind:open={isHoverOpen}>
		{#if activePart && hoverAnchorEl}
			<HoverCard.Content
				customAnchor={hoverAnchorEl}
				class="w-80"
				onmouseenter={closeHover.cancel}
				onmouseleave={handleMouseLeave}
			>
				<div class="flex flex-col gap-2">
					<span
						class="text-lg font-medium whitespace-pre-wrap {TYPE_STYLES[activePart.type].color}"
					>
						„{activePart.text}”
					</span>
					{@render ExplanationContent(activePart)}
				</div>
			</HoverCard.Content>
		{/if}
	</HoverCard.Root>
{:else}
	<Drawer.Root bind:open={isDrawerOpen}>
		<Drawer.Content class="pb-8">
			{#if activePart}
				<Drawer.Header class="text-left">
					<Drawer.Title class="whitespace-pre-wrap {TYPE_STYLES[activePart.type].color}">
						„{activePart.text}”
					</Drawer.Title>
				</Drawer.Header>
				<div class="space-y-3 px-4 pb-2">
					{@render ExplanationContent(activePart)}
				</div>
			{/if}
		</Drawer.Content>
	</Drawer.Root>
{/if}
