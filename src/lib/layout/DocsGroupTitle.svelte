<script lang="ts">
	import { Separator } from '$lib/components/ui/separator';
	import { docsGroups, type DocsGroupId } from '$lib/utils/docsSections';
	import type { Snippet } from 'svelte';

	type Props = { id: DocsGroupId; children?: Snippet };
	let { id, children }: Props = $props();

	const group = $derived(docsGroups.find((g) => g.id === id));
</script>

{#if group}
	<div class="mt-6 -mb-2 flex flex-col gap-4">
		<span class="flex items-center justify-between">
			<h2 class="text-2xl font-semibold">
				{group.label}
			</h2>
			{@render children?.()}
		</span>
		<Separator />
	</div>
{/if}
