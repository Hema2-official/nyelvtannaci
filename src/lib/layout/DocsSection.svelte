<script lang="ts">
	import { docsSections, type DocsSectionId } from '$lib/utils/docsSections';
	import type { Snippet } from 'svelte';

	type Props = { id: DocsSectionId; children: Snippet };
	let { id, children }: Props = $props();

	const section = $derived(docsSections.find((s) => s.id === id));
</script>

<section {id} class="flex scroll-mt-8 flex-col gap-3">
	<h3 class="flex items-center gap-2 text-xl font-semibold">
		{#if section}
			{@const Icon = section.Icon}
			<Icon class="size-5 text-muted-foreground" />
			{section.label}
		{/if}
	</h3>
	<div class="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
		{@render children()}
	</div>
</section>
