<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import {
		CloudUploadIcon,
		ChartColumnIcon,
		HardDriveIcon,
		TriangleAlertIcon
	} from '@lucide/svelte';
	import { PersistedState } from 'runed';
	import { onMount } from 'svelte';

	/** Survives reloads: true once the user has OK'd the welcome dialog. */
	const welcomeAcknowledged = new PersistedState('welcome-acknowledged', false);

	let open = $state(false);

	// Decided only after hydration, so SSR never renders the dialog and localStorage is readable.
	onMount(() => {
		open = !welcomeAcknowledged.current;
	});

	function acknowledge() {
		welcomeAcknowledged.current = true;
		open = false;
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content escapeKeydownBehavior="ignore" class="gap-5">
		<AlertDialog.Header>
			<AlertDialog.Title>Üdv!</AlertDialog.Title>
			<AlertDialog.Description>
				Ez az eszköz a magyar helyesírás ellenőrzésére szolgál: automatikusan kérdezi le
				<a href="https://helyesiras.mta.hu" target="_blank" rel="noopener noreferrer">
					a Magyar Tudományos Akadémia tanácsadó portálját
				</a>. Használat előtt érdemes tudni:
			</AlertDialog.Description>
		</AlertDialog.Header>

		<ScrollArea class="max-h-[50dvh]">
			<ul class="flex flex-col gap-4 pr-3 text-sm text-muted-foreground">
				<li class="flex gap-3">
					<CloudUploadIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
					<div class="flex flex-col gap-1">
						<span class="font-medium text-foreground">A szöveg elhagyja ezt a gépet</span>
						<p>
							Az ellenőrzéshez a beírt szöveg egy harmadik fél által üzemeltetett
							nyelvimodell-szolgáltatóhoz kerül, ezért <span class="font-bold">
								ne írj be olyan személyes adatot vagy titkot,
							</span> amelynek a kiszivárgása problémát jelentene.
						</p>
					</div>
				</li>

				<li class="flex gap-3">
					<ChartColumnIcon class="mt-0.5 size-4 shrink-0" />
					<div class="flex flex-col gap-1">
						<span class="font-medium text-foreground">Névtelen statisztikát gyűjtünk</span>
						<p>
							Mérjük például, hogy hány ellenőrzés indul és mennyi ideig tartanak. Nem tárolunk
							felhasználói azonosítót, IP-címet, sütit vagy a beírt szöveget. Kivételt képeznek
							ugyanakkor az elküldött hibajelentések és visszajelzések: ilyenkor eltároljuk, amit a
							felhasználó önkéntesen megoszt.
						</p>
					</div>
				</li>

				<li class="flex gap-3">
					<HardDriveIcon class="mt-0.5 size-4 shrink-0" />
					<div class="flex flex-col gap-1">
						<span class="font-medium text-foreground">Az előzmények helyben maradnak</span>
						<p>
							Az ellenőrzési előzményeket a böngészőben tároljuk. Más számítógépen nem látszanak, és
							törléskor végleg eltűnnek.
						</p>
					</div>
				</li>

				<li class="flex gap-3">
					<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-orange-400" />
					<div class="flex flex-col gap-1">
						<span class="font-medium text-foreground">Semmi sem garantált</span>
						<p>
							A nyelvi modell és a háttérszolgáltatások is hibázhatnak, a javaslatok pedig nem
							helyettesítik <i>A magyar helyesírás szabályai</i> 12. kiadását. Az eszköz pusztán egy
							jobb helyesírás-ellenőrző megalkotására tett kísérlet. Ilyen formájában semmiféle
							garanciát nem vállalunk, és a használatából eredő kárért sem vállalunk felelősséget.
							<span class="font-bold">Ha hibás javaslatot látsz, jelezd a zászlóikonnal,</span> bármi
							mást pedig a Visszajelzés gombbal. Mindkettő sokat segít.
						</p>
					</div>
				</li>
			</ul>
		</ScrollArea>

		<AlertDialog.Footer>
			<AlertDialog.Action onclick={acknowledge}>Értettem</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
