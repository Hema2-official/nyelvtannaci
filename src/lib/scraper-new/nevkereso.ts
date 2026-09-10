import { MTA_BASE_URL } from '$env/static/private';
import { parse } from 'node-html-parser';
import scraperAxios, { getCached } from './scraperAxios';
import { z } from 'zod';
import type { IntermediateSummary } from '$lib/llm/toolSummary.type';
import type { LLMFunction } from '$lib/llm/llmFunction.type';

export const nevkeresoParams = z.object({
	input: z.string().describe('A keresett tulajdonnév, ahogy a szövegben áll')
});

export type NevkeresoEntry = {
	/** The name as the register spells it. */
	name: string;
	/**
	 * Set when the entry spells the query's own letters back. The register's index ignores
	 * case, accents, spaces and hyphens, so these are the entries that answer "how is this
	 * written"; the others merely start the same way.
	 */
	sameLetters?: true;
	/** Grammar tags, looked up only for the `sameLetters` entries. */
	categories?: string[];
};

export type NevkeresoResult = {
	matches: NevkeresoEntry[];
	/** How many further matches the register returned but this answer does not list. */
	more?: number;
};

/** A short query matches thousands of names, and none of them answers anything. */
const MAX_MATCHES = 10;

/**
 * In practice one entry spells the query back, sometimes two ("Margit-sziget" and
 * "Margitsziget"). Nothing in the register promises that, and each lookup is a request.
 */
const MAX_CATEGORY_LOOKUPS = 3;

/**
 * How the register's own prefix index compares names: case, accents, spaces and hyphens are
 * all invisible to it, which is exactly what lets a wrongly written name find itself.
 */
export function normalise(text: string) {
	return (
		text
			.normalize('NFD')
			.replace(/\p{M}/gu, '')
			// \p{Pd} so an en dash counts as a hyphen: "Duna–Tisza köze"
			.replace(/[\s\p{Pd}]+/gu, '')
			.toLowerCase()
	);
}

/** The page a reader can open. The scraper talks to the AJAX endpoint behind it instead. */
function generateUrl(input: string) {
	return scraperAxios.getUri({
		url: `${MTA_BASE_URL}/helyesiras/default/predict`,
		params: { q: input.trim() }
	});
}

export function parseCategories(html: string): string[] {
	return (
		parse(html)
			.querySelectorAll('.tag')
			// the tags are set with non-breaking spaces, and "földrajzi név" is two words
			.map((tag) => tag.textContent?.replace(/\s+/g, ' ').trim() ?? '')
			.filter(Boolean)
	);
}

async function fetchCategories(id: string): Promise<string[]> {
	const html = await getCached(
		scraperAxios.getUri({ url: `${MTA_BASE_URL}/helyesiras/default/getmodule/`, params: { id } })
	);
	return parseCategories(html);
}

export async function scrapeNevkereso(
	args: z.infer<typeof nevkeresoParams>
): Promise<NevkeresoResult> {
	const input = args.input.trim();

	if (!input) throw new Error('Input is required');
	// as elsewhere, minus the apostrophe: it belongs to names like "L'Aquila"
	if (/[<>"\\]/.test(input)) throw new Error('Invalid input');

	const html = await getCached(
		scraperAxios.getUri({
			url: `${MTA_BASE_URL}/helyesiras/default/gethint/`,
			params: { q: input }
		})
	);

	// an empty ul.result is the register saying it has no such name, and a missing one is the
	// site saying something else entirely - the two must never reach the model as one answer
	const list = parse(html).querySelector('ul.result');
	if (!list) throw new Error('No results found: missing result list in response');

	const items = list.querySelectorAll('li');
	const wanted = normalise(input);

	const rawHits = items.slice(0, MAX_MATCHES).flatMap((item) => {
		const name = item.textContent?.trim();
		const id = item.getAttribute('id')?.match(/^hint_(.+)$/)?.[1];
		return name && id ? [{ name, id, sameLetters: normalise(name) === wanted }] : [];
	});

	// only the entries that spell the query back are worth a request each, and the request is
	// best effort: the spelling is the answer, the category only says which name it belongs to
	const targetMatches = rawHits.filter((hit) => hit.sameLetters).slice(0, MAX_CATEGORY_LOOKUPS);
	const categoryLookups = await Promise.all(
		targetMatches.map(
			async ({ id }) => [id, await fetchCategories(id).catch(() => undefined)] as const
		)
	);
	const categoryMap = new Map(
		categoryLookups.filter(([, categories]) => categories && categories.length > 0)
	);

	return {
		matches: rawHits.map(({ name, id, sameLetters }) => {
			const categories = categoryMap.get(id);
			return {
				name,
				...(sameLetters ? { sameLetters: true as const } : {}),
				...(categories ? { categories } : {})
			};
		}),
		...(items.length > MAX_MATCHES ? { more: items.length - MAX_MATCHES } : {})
	};
}

function provideSummary(
	args: z.infer<typeof nevkeresoParams>,
	result: NevkeresoResult
): IntermediateSummary[] {
	const query = args.input.trim();

	// only the entries spelling the query's letters say anything about how it is written;
	// the rest of the list is longer names that happen to start the same way
	const spellings = result.matches.filter((match) => match.sameLetters);
	const asWritten = spellings.find((match) => match.name === query);

	return [
		{
			tool: 'nevkereso',
			query,
			expression: (asWritten ?? spellings[0])?.name ?? 'nincs találat',
			// two spellings can both be right ("Margit-sziget" and "Margitsziget"), so the
			// verdict is whether any of them is the one the text already uses
			correct: spellings.length ? asWritten !== undefined : undefined,
			explanation:
				spellings.length > 1
					? `A névtár több alakot is ismer: ${spellings.map((match) => match.name).join(', ')}`
					: spellings[0]?.categories?.join(', '),
			shareLink: generateUrl(query)
		}
	];
}

export const nevkeresoFunction = {
	name: 'nevkereso' as const,
	description:
		'Ismert tulajdonnevek (főként földrajzi nevek, települések, közterületek) helyesírásának ellenőrzése: a megadott kezdőkarakterekkel folytatható nevek, a hivatalos írásmódjukban és nyelvtani kategóriáikkal együtt. A keresés nem érzékeny a kis- és nagybetűkre, az ékezetekre, a szóközökre és a kötőjelekre, ezért a rosszul írt név is megtalálja önmagát: a sameLetters jelölésű találat írja le ugyanazokat a betűket. A névtár nem teljes, intézményneveket alig tartalmaz: a találat hiánya semmit nem bizonyít, sem a név helyességét, sem a hibáját - ilyenkor a többi eszköz dönt.',
	parameters: nevkeresoParams,
	callback: scrapeNevkereso,
	summarize: provideSummary
} satisfies LLMFunction<typeof nevkeresoParams, NevkeresoResult>;
