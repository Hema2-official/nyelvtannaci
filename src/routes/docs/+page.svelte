<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import DocsSection from '$lib/layout/DocsSection.svelte';
	import DocsGroupTitle from '$lib/layout/DocsGroupTitle.svelte';
	import { maxInputLength } from '$lib/utils/limits';
	import { FlagIcon } from '@lucide/svelte';
	import { PersistedState } from 'runed';
	import { cn } from '$lib/utils/shadcn';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type ReaderType = 'normal' | 'technical';

	const readerOptions: { value: ReaderType; label: string }[] = [
		{ value: 'normal', label: 'Mindenkinek' },
		{ value: 'technical', label: 'Hozzáértőknek' }
	];
	let reader: PersistedState<ReaderType> = new PersistedState('reader-type', 'normal');
</script>

<svelte:head>
	<title>Tudnivalók — Helyesírás-ellenőrző</title>
	<meta name="description" content="Mi ez, és hogyan működik?" />
</svelte:head>

{#snippet ExternalLink(text: string, href: string, className: string = '')}
	<a {href} target="_blank" rel="noopener noreferrer" class={cn(`underline ${className}`)}>
		{text}
	</a>
{/snippet}

<div class="flex w-full max-w-3xl flex-col gap-8 px-6 pt-4 pb-16 md:pt-12">
	<DocsGroupTitle id="tudnivalok" />

	<DocsSection id="mi-ez">
		<p>
			Ez az eszköz a megadott magyar szövegrészletek helyesírását ellenőrzi
			{@render ExternalLink('az MTA helyesírási tanácsadó portálját', 'https://helyesiras.mta.hu')} lekérdezve.
			Eldönti, hogy mit érdemes ellenőrizni és hogyan kell a kapott eredményeket a szövegre alkalmazni,
			majd megindokolva javasol egy vagy több helyesnek vélt alakot.
		</p>
		<p>
			De miért készült ez? Sok magyar, ha ugyan használja is az MTA eszközeit íráskor, mégsem figyel
			oda azok eredményeire, és sokszor rosszul bírálja el azok helyességét vagy szövegkörnyezeti
			alkalmazhatóságát. Bár az ellenőrzés itt is egy fontos lépés, a feladat nagy része átruházódik
			az eszközre. Ezen kívül sokkal egyszerűbb egy szövegrészt ellenőriztetni, mint külön-külön
			szószerkezetekre és kifejezésekre kézileg alkalmazni az MTA eszközeit.
		</p>
	</DocsSection>

	<DocsSection id="hasznalat">
		<ul class="flex list-disc flex-col gap-2 ps-5">
			<li>
				Egyszerre legfeljebb <b>{maxInputLength} karaktert</b> lehet ellenőrizni.
			</li>
			<li>
				Érdemes a lehető legpontosabb formában megadni az ellenőrizendő szöveget. Minél több a hiba,
				annál kisebb eséllyel kerül az összes javításra, és annál tovább tart a folyamat.
			</li>
			<li>
				Minden lefutott ellenőrzés bekerül az <b>Előzmények</b> listájába, ahonnan újra meg lehet tekinteni
				vagy éppen törölni őket.
			</li>
			<li>
				Eredményekkel kapcsolatos probléma a <FlagIcon class="inline size-4" />
				<span class="sr-only">zászló</span>ikonnal jelenthető, egyéb dolgokat a bal alsó sarokban
				található visszajelzésgombra kattintva lehet beküldeni.
			</li>
		</ul>
	</DocsSection>

	<DocsSection id="korlatok">
		<ul class="flex list-disc flex-col gap-2 ps-5">
			<li>
				A javaslatok <b>nem helyettesítik</b> <i>A magyar helyesírás szabályai</i> 12. kiadását. Ez az
				eszköz pusztán egy kísérlet egy jobb helyesírás-ellenőrző megalkotására, nem szolgál hivatkozási
				alapként.
			</li>
			<li>
				A 12. kiadás megváltoztatott olyan szabályokat, amelyekre a kiadása előtt sűrűn hivatkoztak
				különböző internetes fórumokon. Helyenként maga a portál is keveri a két kiadást, így
				előfordulhatnak ebből adódó következetlenségek.
			</li>
			<li>
				Vannak erősségei és gyengeségei az eszköznek, például központozást nem javít megbízhatóan.
			</li>
			<li>
				A szolgáltatás bármikor kieshet vagy szünetelhet. Többek között ennek elkerülése érdekében
				adományokat gyűjtünk az oldal bal alsó sarkában.
			</li>
		</ul>
	</DocsSection>

	<DocsSection id="adatkezeles">
		<ul class="flex list-disc flex-col gap-2 ps-5">
			<li>
				<b>A szöveg elhagyja ezt a gépet.</b> Az ellenőrzéshez a beírt szöveg egy harmadik fél által üzemeltetett
				nyelvimodell-szolgáltatóhoz kerül (elképzelhető, hogy az EU-n kívülre), ezért nem érdemes olyan
				személyes adatot vagy titkot megadni, amelynek a kiszivárgása problémát jelentene.
			</li>
			<li>
				<b>Névtelen statisztikát gyűjtünk.</b> Mérjük például, hogy hány ellenőrzés indul és mennyi ideig
				tartanak. Felhasználói azonosítót, IP-címet, sütit vagy beírt szöveget nem tárolunk. A mért statisztikát
				90 napig tároljuk az EU-ban.
			</li>
			<li>
				<b>A visszajelzés kivétel.</b> Az önkéntesen elküldött hibajelentéseket és visszajelzéseket minden
				szándékosan megosztott információval együtt tároljuk.
			</li>
			<li>
				<b>Az előzmények helyben maradnak.</b> Az ellenőrzési előzményeket a böngésző tárolja. Más gépen
				nem látszanak, a böngésző adatainak törlésekor pedig véglegesen eltűnnek. (Ezek az előzmények
				nem jelennek meg a böngészési előzmények között, csak a helyesírás-ellenőrző főoldalán.)
			</li>
		</ul>
	</DocsSection>

	<DocsGroupTitle id="technikai-reszletek">
		<Select.Root type="single" items={readerOptions} bind:value={reader.current}>
			<Select.Trigger class="w-45"><Select.Value /></Select.Trigger>
			<Select.Content>
				<Select.Group>
					{#each readerOptions as option (option.value)}
						<Select.Item value={option.value} label={option.label}>{option.label}</Select.Item>
					{/each}
				</Select.Group>
			</Select.Content>
		</Select.Root>
	</DocsGroupTitle>

	{#if reader.current === 'normal'}
		<DocsSection id="ellenorzesi-folyamat">
			<p>Az ellenőrzés egy több lépésből álló folyamat. Így épül fel:</p>
			<ol class="flex list-decimal flex-col gap-2 ps-5">
				<li>
					<b>Biztonsági lépés.</b> A bemeneti szöveg átmegy egy szűrőn, ami személyes adatokat és titkokat
					keres: többek között címeket, banki részleteket, telefonszámokat. Ha ilyesminek tűnő szöveget
					talál, óvatosságra inti a felhasználót ahelyett, hogy belekezdene az ellenőrzésbe.
				</li>
				<li>
					<b>Értelmezés.</b> Egy nagy nyelvi modell (röviden LLM; hasonló a ChatGPT-hez vagy a Gemini-hoz)
					elolvassa a bemeneti szöveget, és átgondolja, hogy az mit jelent. Később ez alapján dönt az
					MTA eszközei által tett javaslatokról.
				</li>
				<li>
					<b>A kifejezések összegyűjtése.</b> Összeszedi, amire érdemes rákérdezni: a lehetséges összetételeket,
					a toldalékolt alakokat, a felsorolások tagjait, a tulajdonneveket, a dátumokat és a számokat.
					A számára helyesnek látszó dolgokkal is igyekszik számolni, mert sokszor éppen azok bizonyulnak
					hibásnak.
				</li>
				<li>
					<b>Lekérdezés.</b> Az összegyűjtött kifejezéseket egyszerre küldi el a portál hat
					eszközének (<i>Külön vagy egybe?</i>, <i>Helyes-e így?</i>, <i>Elválasztás</i>,
					<i>Névkereső</i>, <i>Dátumok</i> és <i>Számok</i>), mindegyiket abban a formában, amelyet
					az adott eszköz vár.
				</li>
				<li>
					<b>Összevetés.</b> Az eszközök eredményeit összeveti azzal, ahogyan a szöveg az adott alakot
					tartalmazza. Ha a magyarázat nem illik a használt alakra, elveti, és más megoldás felé néz.
					Abban az esetben, ha valamilyen információ további kérdéseket vet föl, a folyamat szabadon visszatérhet
					az előző lépésekre, futtathat további lekérdezéseket.
				</li>
				<li>
					<b>Az eredmény összeállítása.</b> A javított szöveg részekre bomlik, és a modell részletenként
					megindokolja, milyen változtatásokat miért végzett (ha végzett). Ezek után szűrők ellenőrzik
					a kimeneti szöveg formai követelményeit. Ha minden rendben van, megjelenik az eredmény.
				</li>
			</ol>
			<p>
				Mindeközben a <b>Források</b> oszlopban az összes lekérdezés valós időben megjelenik, épp ahogyan
				a modell használja őket; a jobb oldalukon található linkre kattintva pedig megtekinthetjük a javaslatokat
				az eredeti oldalon.
			</p>
		</DocsSection>
	{:else if reader.current === 'technical'}
		<DocsSection id="ellenorzesi-folyamat">
			<p>
				A folyamat agya egy megfizethető LLM (tesztadatokról lejjebb írok), ami jó esetben
				OpenRouterről megy; a promptja megtalálható a <code>src/lib/llm/promptConfig.ts</code> fájlban.
				Architekturálisan nagyjából így néz ki:
			</p>
			<ol class="flex list-decimal flex-col gap-2 ps-5">
				<li>
					Még a böngészőben a szöveg átmegy egy regex-szűrőn, ami személyes adatokat és titkokat
					keres (pl. címek, elérhetőségek, banki adatok, API-kulcsok, jelszavak stb.), és találat
					esetén feldob egy figyelmeztetést, mielőtt belekezd.
				</li>
				<li>
					A folyamat elején a bemeneti szöveg mondatonkénti (algoritmikus) szétbontásra kerül a
					köztük lévő űr megőrzésével, és minden mondat egy-egy külön folyamatba kerül.
				</li>
				<li>
					A modell mindig ösztönözve van a kifejezések értelmezésére, hogy az MTA-s eredményekről
					helyesen el tudja dönteni, odaillenek-e.
				</li>
				<li>
					Az MTA-s eszközök a nevükkel és a rövid leírásukkal együtt (ami az oldalukon látható)
					elérhetőek a modell számára szokványos tool calling keretein belül. Magukon a nyers webes
					eszközökön van néhány primitív scraping-blokkoló mechanizmus, de először is simán
					áthidalhatóak (talán a repoban még látható is), másodszor rájöttem, hogy
					<code>?q=valami</code> stílusú megosztó linkek elsőre betöltik az eredményt, úgyhogy egy
					nagyon olcsó, böngészőmentes scraping lett a végeredmény. Túl sok egymás utáni
					lekérdezéskor <code>500</code>-as választ adnak (valamiért nem 429, de nem is rate
					limitingről van szó, mert teljesen véletlenszerű), úgyhogy legfeljebb 5-ször újrapróbálja
					a scraper. A nem 500-as hibák (pl. "Az Ön által megadott [...] bemenet nagybetűvel
					kezdődik...") simán átadásra kerülnek a modell felé.
				</li>
				<li>
					Van egy result tool, amit a folyamat végén kell meghívnia a modellnek. Ez egy részletekből
					álló formátumot fogad el: egy részlet lehet eredeti, javított, hozzáadott vagy
					eltávolított. Olyasmi, mint egy diff, de azt simán nem lehetett volna alkalmazni, hiszen
					minden változtatáshoz indoklás kell. Így a részletekben beérkezett szöveget a program
					összerakja és ellenőrzi, hogy nem történt-e súlyos adatvesztés a bemenethez képest,
					valamint a végeredmény követelményeinek megfelel-e (pl. a szavak közt megmaradt-e a
					helyköz). Ha mégis, leírja a szabályt, ami alapján visszautasítja, és visszaküldi még egy
					körre az LLM-nek.
				</li>
				<li>
					A folyamat során a használt eszközökről {@render ExternalLink(
						'SSE',
						'https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events'
					)}-n keresztül érkeznek összefoglalók és URL-ek, hogy a felhasználó saját maga el tudja
					olvasni a forrásként használt javaslatokat.
				</li>
				<li>
					A végén megjön az eredmény, és IndexedDB-be bekerül a bemenettel együtt: itt lelhetőek az
					előzmények. Kész!
				</li>
			</ol>
			<p>
				A jelenleg aktív LLM a <a href="#kornyezeti-adatok">környezeti adatok</a> közt található, de
				valószínűleg a
				<code>
					{@render ExternalLink(
						'DeepSeek V4.1 Flash',
						'https://openrouter.ai/deepseek/deepseek-v4.1-flash'
					)}
				</code>
				vagy a DeepSeek más új generációs modellje van használatban, ugyanis folyton fejlesztenek a hatékonyságukon,
				és majdnem mindig megnyerik az ár-érték arány versenyét. Az alábbi táblázatban különböző modellek
				teljesítménye látható erre a feladatra mérve, 27 könnyűtől nehézig terjedő példamondattal próbálva
				(<code>pnpm run bench</code>):
			</p>

			<!-- TODO -->

			<p>
				A költség az OpenRouter 2026. szeptemberi listaárai (USD) szerint, a modellek mért
				fogyasztása alapján lett kiszámolva. A modellek költségei közötti eltérés nem csupán az
				árazásból jön, hanem abból is, hogy melyik mennyit gondolkodik egy ellenőrzés folyamán.
			</p>
			<p>
				Az adatok alapján jelenleg a DeepSeek legújabb modellje biztosítja az optimumot
				ár-teljesítmény arány és sebesség szerint.
			</p>
		</DocsSection>
	{/if}

	<DocsSection id="kornyezeti-adatok">
		{#if data.llm}
			<p>A szerver konfigurációja:</p>
			<ul class="flex list-disc flex-col gap-2 ps-5">
				<li>Provider: <code>{data.llm.provider}</code></li>
				<li>Model: <code>{data.llm.model}</code></li>
				<li>Reasoning effort: <code>{data.llm.reasoningEffort ?? 'default'}</code></li>
				<li>Input limit: <code>{maxInputLength}</code> characters</li>
			</ul>
		{:else}
			<p class="text-destructive">A konfigurációt nem lehetett kiolvasni.</p>
		{/if}
	</DocsSection>
</div>
