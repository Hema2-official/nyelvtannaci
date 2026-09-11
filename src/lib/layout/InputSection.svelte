<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Kbd from '$lib/components/ui/kbd';
	import { TextareaAutosize, type ResourceReturn } from 'runed';
	import type { SuccessfulResult } from '$lib/llm/promptConfig';
	import { viewState } from '$lib/states/ViewState.svelte';
	import WarningDialog from './WarningDialog.svelte';
	import { findPersonalData, type PersonalDataMatch } from '$lib/utils/personalData';

	type Props = { checkResource: ResourceReturn<SuccessfulResult, unknown, false> };
	let { checkResource }: Props = $props();

	let textareaRef: HTMLTextAreaElement | null = $state(null);
	new TextareaAutosize({
		element: () => textareaRef ?? undefined,
		input: () => viewState.currentInput
	});

	let allowSubmit = $derived(viewState.currentInput.length > 0 && !checkResource.loading);

	let warningOpen = $state(false);
	let personalDataMatches: PersonalDataMatch[] = $state([]);

	function handleSubmit() {
		if (!allowSubmit) return;

		const matches = findPersonalData(viewState.currentInput);
		if (matches.length > 0) {
			personalDataMatches = matches;
			warningOpen = true;
			return;
		}

		checkResource.refetch();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

<div class="relative flex h-fit w-full flex-col">
	<Label class="pb-2 text-lg text-muted-foreground" for="input-editor">Ellenőrizendő szöveg</Label>
	<Textarea
		id="input-editor"
		class="max-h-[40dvh] min-h-36 w-full resize-none overflow-y-auto! border-none px-3 py-2.5 text-base! outline-none"
		bind:ref={textareaRef}
		bind:value={viewState.currentInput}
		disabled={checkResource.loading}
		onkeydown={handleKeydown}
	/>
	<div class="flex w-full items-center justify-between gap-2 pt-2">
		<span
			class="text-sm text-muted-foreground transition-opacity
                select-none {allowSubmit ? 'opacity-60' : 'opacity-40'}"
		>
			<Kbd.Group>
				<Kbd.Root>Ctrl</Kbd.Root>
				<span>+</span>
				<Kbd.Root>Enter</Kbd.Root>
			</Kbd.Group>
			az elküldéshez
		</span>
		<Button class="w-fit" disabled={!allowSubmit} onclick={handleSubmit}>
			{#if checkResource.loading}<Spinner data-icon="inline-end" /> Elemzés{:else}Mehet{/if}
		</Button>
	</div>

	<WarningDialog
		bind:open={warningOpen}
		matches={personalDataMatches}
		onconfirm={() => checkResource.refetch()}
	/>
</div>
