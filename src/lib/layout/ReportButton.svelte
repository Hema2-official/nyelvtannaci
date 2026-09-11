<script lang="ts">
	import type { SuccessfulResult } from '$lib/llm/promptConfig';
	import { FlagIcon } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { Spinner } from '$lib/components/ui/spinner';
	import { toast } from 'svelte-sonner';
	import { viewState } from '$lib/states/ViewState.svelte';
	import { submit } from '$lib/api/analytics';

	type Props = { result: SuccessfulResult };
	let { result }: Props = $props();

	let open = $state(false);
	let message = $state('');
	let submitting = $state(false);

	async function handleSubmit() {
		if (submitting) return;
		submitting = true;

		try {
			await submit({
				kind: 'report',
				input: viewState.currentInput,
				summaries: viewState.intermediateSummaries,
				result,
				message: message.trim() || undefined
			});

			toast.success('Nagyon szépen köszönjük! :)');
			open = false;
			message = '';
		} catch (err) {
			console.error('Failed to submit report:', err);
			toast.error('Hiba történt: nem sikerült elküldeni a jelentést.');
		} finally {
			submitting = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		<Button
			variant="ghost"
			size="icon"
			class="text-muted-foreground hover:text-destructive"
			onclick={() => (open = true)}
		>
			<FlagIcon class="size-3.5" />
		</Button>
	</Tooltip.Trigger>
	<Tooltip.Content side="top">
		<p>Hibás eredmény jelentése</p>
	</Tooltip.Content>
</Tooltip.Root>

<Dialog.Root bind:open>
	<Dialog.Content class="gap-5">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<FlagIcon class="size-5 text-destructive" />
				Hibás eredmény jelentése
			</Dialog.Title>
			<Dialog.Description>
				Ha a javasolt alak pontatlan vagy hibás, érdemes jelenteni. <br />
				A beküldött adatok segítenek a módszer javításában.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-2">
			<Label for="report-message" class="font-medium text-muted-foreground">
				Megjegyzés vagy indoklás (nem kötelező)
			</Label>
			<Textarea
				id="report-message"
				placeholder={'Pl. Itt külön kellene írni, hogy "ezen kívül"...'}
				class="min-h-24 resize-none text-sm"
				maxlength={2000}
				bind:value={message}
				disabled={submitting}
				onkeydown={handleKeydown}
			/>
			<span class="text-xs text-muted-foreground opacity-90">
				A beküldéssel névtelenül megosztásra kerül a teljes szövegbemenet.
			</span>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)} disabled={submitting}>Mégse</Button>
			<Button onclick={handleSubmit} disabled={submitting}>
				{#if submitting}<Spinner class="size-4" />{/if}
				Küldés
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
