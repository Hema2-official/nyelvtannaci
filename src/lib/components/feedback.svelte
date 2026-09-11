<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Spinner } from '$lib/components/ui/spinner';
	import { MessageSquareIcon } from '@lucide/svelte';
	import { submit } from '$lib/api/analytics';
	import { toast } from 'svelte-sonner';
	import Link from './link.svelte';

	let open = $state(false);
	let message = $state('');
	let submitting = $state(false);

	let allowSubmit = $derived(message.trim().length > 0 && !submitting);

	function handleSubmit() {
		if (!allowSubmit) return;
		submitting = true;

		submit({ kind: 'feedback', message: message.trim() })
			.then(() => {
				toast.success('Nagyon szépen köszönjük! :)'); // fr nagyon hasznos a feedback amugy, irjatok legyszi!!!
				open = false;
				message = '';
			})
			.catch((err) => {
				console.error('Failed to submit feedback:', err);
				toast.error('Hiba történt: nem sikerült elküldeni a visszajelzést.');
			})
			.finally(() => {
				submitting = false;
			});
	}
</script>

<Link
	Icon={MessageSquareIcon}
	label="Visszajelzés"
	badgeClass="bg-slate-600 not-dark:bg-slate-500"
	description="Bármivel kapcsolatban"
	onclick={() => (open = true)}
/>

<Dialog.Root bind:open>
	<Dialog.Content class="gap-5">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<MessageSquareIcon class="size-5 text-primary" />
				Visszajelzés küldése
			</Dialog.Title>
			<Dialog.Description>
				Valami nem tetszik? Hiba tapasztalható? Esetleg egy ötletről van szó? Mindenről szívesen
				hallanánk!
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-2">
			<Textarea
				id="feedback-message"
				placeholder="Vélemény, észrevétel..."
				class="min-h-28 resize-none text-sm"
				maxlength={5000}
				bind:value={message}
				disabled={submitting}
			/>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)} disabled={submitting}>Mégse</Button>
			<Button onclick={handleSubmit} disabled={!allowSubmit}>
				{#if submitting}<Spinner class="size-4" />{/if}
				Küldés
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
