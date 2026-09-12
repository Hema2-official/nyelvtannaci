<script lang="ts">
	import type { SuccessfulResult } from '$lib/llm/promptConfig';
	import { CheckIcon, CopyIcon } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { toast } from 'svelte-sonner';
	import { viewState } from '$lib/states/ViewState.svelte';
	import { useDebounce } from 'runed';
	import { track } from '$lib/api/analytics';

	type Props = { result: SuccessfulResult };
	let { result }: Props = $props();

	let copied = $state(false);
	const resetCopied = useDebounce(() => {
		copied = false;
	}, 2000);

	const correctedText = $derived(
		result.resultParts.length > 0
			? result.resultParts
					.filter((p) => p.type !== 'removed')
					.map((p) => p.text)
					.join('')
			: viewState.currentInput
	);

	async function handleCopy() {
		if (!correctedText) return;

		try {
			await navigator.clipboard.writeText(correctedText);
			track({ kind: 'copy' });
			copied = true;
			resetCopied();
		} catch (err) {
			console.error('Failed to copy: ', err);
			toast.error('Nem sikerült a vágólapra másolni');
		}
	}
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		<Button variant="ghost" size="icon" class="text-muted-foreground" onclick={handleCopy}>
			{#if copied}<CheckIcon class="size-3.5" />
			{:else}<CopyIcon class="size-3.5" />{/if}
		</Button>
	</Tooltip.Trigger>
	<Tooltip.Content side="top">
		<p>Másolás a vágólapra</p>
	</Tooltip.Content>
</Tooltip.Root>
