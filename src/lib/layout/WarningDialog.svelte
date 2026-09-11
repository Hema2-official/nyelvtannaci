<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { ShieldAlertIcon } from '@lucide/svelte';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import {
		countPersonalData,
		groupPersonalData,
		type PersonalDataMatch
	} from '$lib/utils/personalData';
	import { track } from '$lib/api/analytics';

	type Props = {
		open: boolean;
		matches: PersonalDataMatch[];
		onconfirm: () => void;
	};
	let { open = $bindable(), matches, onconfirm }: Props = $props();

	let groups = $derived(groupPersonalData(matches));

	function report(outcome: 'proceeded' | 'edit' | 'dismissed') {
		track({ kind: 'warning', detected: countPersonalData(matches), outcome });
	}

	function handleOpenChange(next: boolean) {
		if (!next) report('dismissed');
	}

	function edit() {
		report('edit');
		open = false;
	}

	function confirm() {
		report('proceeded');
		open = false;
		onconfirm();
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content showCloseButton={false} class="gap-5">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<ShieldAlertIcon class="text-destructive" />
				Személyes adatnak tűnő részlet{matches.length > 1 ? 'ek' : ''}
			</Dialog.Title>
			<Dialog.Description>
				A szöveg ellenőrzéséhez annak el kell jutnia egy olyan számítógépre, amit már nem mi
				irányítunk. <br />
				Célszerű biztosra menni, hogy a megadott szövegben
				<span class="font-bold">nem szerepelnek féltett személyes adatok vagy titkok,</span>
				amelyek így esetlegesen kiszivároghatnak. <br />
				Automatikus szűrésünk az alábbi adatokat találta:
			</Dialog.Description>
		</Dialog.Header>

		<ScrollArea class="max-h-[40dvh]">
			<ul class="flex flex-col gap-3 pr-3">
				{#each groups as group (group.kind)}
					<li class="flex flex-col gap-1">
						<span class="text-xs font-medium text-muted-foreground">{group.label}</span>
						<div class="flex flex-wrap gap-1.5">
							{#each group.texts as text (text)}
								<code
									class="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs break-all text-foreground"
									>{text}
								</code>
							{/each}
						</div>
					</li>
				{/each}
			</ul>
		</ScrollArea>

		<Dialog.Footer>
			<Button variant="outline" onclick={edit}>Vissza a szerkesztéshez</Button>
			<Button variant="destructive" onclick={confirm}>Mehet</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
