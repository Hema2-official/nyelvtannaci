import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import scraperAxios from '$lib/scraper-new/scraperAxios';
import { scrapeDatumok } from '$lib/scraper-new/datumok';
import { elvalasztasFunction, scrapeElvalasztas } from '$lib/scraper-new/elvalasztas';
import { scrapeHelyesEIgy } from '$lib/scraper-new/helyesEIgy';
import { scrapeKulonVagyEgybe } from '$lib/scraper-new/kulonVagyEgybe';
import { scrapeSzamok } from '$lib/scraper-new/szamok';
import { scrapeNevkereso } from '$lib/scraper-new/nevkereso';
import { mtaResponseCache } from '$lib/scraper-new/responseCache';
import { availableFunctions } from '$lib/llm/promptConfig';

/** Make any request fail, so a test can prove no request was attempted. */
function refuseRequests() {
	return vi
		.spyOn(scraperAxios, 'get')
		.mockRejectedValue(new Error('the scraper reached the network with a rejected input'));
}

/**
 * Every scraper puts the model's argument straight into a URL, so the guard has to hold
 * before any request goes out. The mock is here to fail loudly if one ever slips through.
 */
describe.each([
	['kulon_vagy_egybe', scrapeKulonVagyEgybe],
	['helyes-e_igy', scrapeHelyesEIgy],
	['elvalasztas', scrapeElvalasztas]
])('%s input validation', (_name, scrape) => {
	let request: ReturnType<typeof refuseRequests>;

	beforeEach(() => {
		request = refuseRequests();
	});

	afterEach(() => vi.restoreAllMocks());

	it.each([
		['empty', ''],
		['markup', '<script>'],
		['a closing tag', 'szó</b>'],
		['a quote', "szó'"],
		['a double quote', 'szó"'],
		['a slash', 'szó/másik'],
		['a backslash', 'szó\\másik']
	])('rejects %s without asking the site', async (_label, input) => {
		await expect(scrape({ input })).rejects.toThrow();
		expect(request).not.toHaveBeenCalled();
	});
});

/**
 * These two take a machine-readable input the model has to build, so the guard is an
 * allowlist rather than a blocklist: anything that is not a date or a number never goes out.
 */
describe.each([
	[
		'datumok',
		scrapeDatumok,
		['2024-01-01', ' 2024-01-01 '],
		['', '2024.01.01', '2024. január 1.', '1-01-01', 'abc', '2024-01-01; DROP', '<script>']
	],
	[
		'szamok',
		scrapeSzamok,
		['2024', '-5', '3,5', '1/2', ' 2024 '],
		['', 'kétezer', '2024 db', 'abc', '2e4', '<script>']
	]
])('%s input validation', (_name, scrape, accepted, rejected) => {
	let request: ReturnType<typeof refuseRequests>;

	beforeEach(() => {
		request = refuseRequests();
	});

	afterEach(() => vi.restoreAllMocks());

	it.each(rejected)('rejects %j without asking the site', async (input) => {
		await expect(scrape({ input })).rejects.toThrow();
		expect(request).not.toHaveBeenCalled();
	});

	it.each(accepted)('lets %j through to the site', async (input) => {
		// the mock rejects everything, so reaching it is the assertion
		await expect(scrape({ input })).rejects.toThrow(/reached the network/);
		expect(request).toHaveBeenCalledOnce();
	});
});

/**
 * nevkereso keeps the apostrophe the other guards reject: it belongs to names like
 * "L'Aquila", and the value of a name lookup is exactly that it takes the name as written.
 */
describe('nevkereso input validation', () => {
	let request: ReturnType<typeof refuseRequests>;

	beforeEach(() => {
		request = refuseRequests();
		mtaResponseCache.clear();
	});

	afterEach(() => vi.restoreAllMocks());

	it.each([
		['empty', ''],
		['markup', '<script>'],
		['a double quote', 'Petőfi"'],
		['a backslash', 'Petőfi\\híd']
	])('rejects %s without asking the site', async (_label, input) => {
		await expect(scrapeNevkereso({ input })).rejects.toThrow();
		expect(request).not.toHaveBeenCalled();
	});

	it('lets a name with an apostrophe through', async () => {
		await expect(scrapeNevkereso({ input: "L'Aquila" })).rejects.toThrow(/reached the network/);
		expect(request).toHaveBeenCalledOnce();
	});
});

/**
 * The dictionary answers in three states and the parser used to read two of them. The third,
 * `unknown="YESNO"`, is "helyes az AkH11 szerint, ismeretlen az AkH12 szerint" - the state
 * every word the 2015 revision moved comes back in, and the state that made "munkaerő-piaci"
 * read as confirmed while the form that replaced it sat in the same answer's suggestions.
 *
 * The markup below is verbatim from the site, whitespace included.
 */
describe('helyes-e_igy edition verdicts', () => {
	beforeEach(() => mtaResponseCache.clear());
	afterEach(() => vi.restoreAllMocks());

	function serve(html: string) {
		vi.spyOn(scraperAxios, 'get').mockResolvedValue({
			data: `<ul class="result">${html}</ul>`
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);
	}

	it('reads a form the 12th edition dropped as wrong, and says why', async () => {
		serve(
			'<li unknown=YESNO>&bdquo;munkaerő-piaci&rdquo;: \n\n\n  <br>\n  <a href="/helyesiras/default/akh11" target="_blank">AkH11</a> szerint: helyes<br>\n  <a href="/helyesiras/default/akh12" target="_blank">AkH12</a> szerint: ismeretlen; javaslatok: <span class="suggest_list">munkaerőpiaci</span>\n\n\n\n\n</li>'
		);

		const [result] = await scrapeHelyesEIgy({ input: 'munkaerő-piaci' });

		expect(result.correct).toBe(false);
		expect(result.editions).toBe('AkH11 szerint: helyes, AkH12 szerint: ismeretlen');
		// the replacement was always in the answer; it just arrived next to a "correct" verdict
		expect(result.suggestions).toEqual(['munkaerőpiaci']);
	});

	it('reads a form the 12th edition introduced as right, and says why', async () => {
		serve(
			'<li unknown=NO>&bdquo;észszerű&rdquo;: \n\n\n\n  <br>\n  <a href="/helyesiras/default/akh11" target="_blank">AkH11</a> szerint: ismeretlen<br>\n  <a href="/helyesiras/default/akh12" target="_blank">AkH12</a> szerint: helyes\n\n\n\n</li>'
		);

		const [result] = await scrapeHelyesEIgy({ input: 'észszerű' });

		expect(result.correct).toBe(true);
		// the half that has to outweigh the reader's memory of "ésszerű"
		expect(result.editions).toBe('AkH11 szerint: ismeretlen, AkH12 szerint: helyes');
	});

	it('leaves a plain verdict alone', async () => {
		serve(
			'<li unknown=YES>&bdquo;parabén&rdquo;: \n\n\n\n\n  <b>ismeretlen</b>\n  \n    <br>Javaslatok: <span class="suggest_list">arabén, darabén, parajén, aparabén, piarabén</span>\n  \n\n\n</li>'
		);

		const [result] = await scrapeHelyesEIgy({ input: 'parabén' });

		expect(result.correct).toBe(false);
		expect(result.editions).toBeUndefined();
	});
});

/**
 * The one piece of judgement in the scraper: which of the register's prefix matches spell
 * the letters that were asked about. Everything downstream - the model's decision, the
 * category lookups, the summary - hangs off that flag.
 */
describe('nevkereso match marking', () => {
	beforeEach(() => mtaResponseCache.clear());
	afterEach(() => vi.restoreAllMocks());

	/** The register's real markup, trimmed to what the parser reads. */
	function serve(names: Record<string, string>) {
		const items = Object.entries(names)
			.map(([id, name]) => `<li class="short" id="hint_${id}">${name}</li>`)
			.join('');
		const categories =
			'<span class="tag">tulajdonn&eacute;v</span> <span class="tag">f&ouml;ldrajzi&nbsp;n&eacute;v</span>';

		// axios overloads do not narrow to a single call shape, and the scraper reads only .data
		vi.spyOn(scraperAxios, 'get').mockImplementation((async (url: string) => ({
			data: url.includes('/getmodule/') ? categories : `<ul class="result">${items}</ul>`
		})) as unknown as typeof scraperAxios.get);
	}

	it('marks the entry that spells the query, across hyphens, spaces, accents and case', async () => {
		serve({ '1': 'Petőfi híd', '2': 'Petőfi hídi', '3': 'Petőfi hídon' });

		const result = await scrapeNevkereso({ input: 'petofi-hid' });

		expect(result.matches.map((match) => [match.name, match.sameLetters === true])).toEqual([
			['Petőfi híd', true],
			['Petőfi hídi', false],
			['Petőfi hídon', false]
		]);
	});

	it('looks a category up for the marked entries only', async () => {
		serve({ '1': 'Margit-sziget', '2': 'Margitsziget', '3': 'Margitsziget utca' });

		const result = await scrapeNevkereso({ input: 'Margitsziget' });

		// two spellings of the same letters: the register offers both and settles nothing
		expect(result.matches[0].categories).toEqual(['tulajdonnév', 'földrajzi név']);
		expect(result.matches[1].categories).toEqual(['tulajdonnév', 'földrajzi név']);
		expect(result.matches[2].categories).toBeUndefined();
	});

	it('refuses a page it cannot read rather than reporting an unknown name', async () => {
		// a maintenance page, a redesign, a 200 that is not the fragment: none of those mean
		// "the register has no such name", and answering as if they did is a silent wrong answer
		vi.spyOn(scraperAxios, 'get').mockResolvedValue({
			data: '<html><body><h1>Internal error</h1></body></html>'
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);

		await expect(scrapeNevkereso({ input: 'Petőfi híd' })).rejects.toThrow(/No results found/);
	});

	it('reads an empty list as the register having no such name', async () => {
		serve({});

		expect(await scrapeNevkereso({ input: 'Nyugati pályaudvar' })).toEqual({ matches: [] });
	});

	it('still answers when a category lookup fails', async () => {
		vi.spyOn(scraperAxios, 'get').mockImplementation((async (url: string) => {
			if (url.includes('/getmodule/')) throw new Error('500');
			return { data: '<ul class="result"><li id="hint_1">Petőfi híd</li></ul>' };
		}) as unknown as typeof scraperAxios.get);

		const result = await scrapeNevkereso({ input: 'Petőfi-híd' });

		expect(result.matches).toEqual([{ name: 'Petőfi híd', sameLetters: true }]);
	});

	it('says how many matches it left out rather than truncating in silence', async () => {
		serve(Object.fromEntries(Array.from({ length: 14 }, (_, i) => [i + 1, `Aachen ${i}`])));

		const result = await scrapeNevkereso({ input: 'a' });

		expect(result.matches).toHaveLength(10);
		expect(result.more).toBe(4);
	});
});

describe('tool definitions', () => {
	it('gives every tool a name and a description the model can act on', () => {
		for (const tool of availableFunctions) {
			expect(tool.name).toMatch(/^[a-z0-9_-]+$/i);
			expect(tool.description.length).toBeGreaterThan(20);
		}
	});

	it('explains the hyphenation notation, which the output alone does not', () => {
		// "he-lyes|-í-rás" only makes sense with the legend, and the legend is static,
		// so it belongs in the schema the model reads once rather than in every result
		expect(elvalasztasFunction.description).toContain(
			'a "-"-jel a lehetséges elválasztási határokat'
		);
		expect(elvalasztasFunction.description).toContain('szóösszetételi határokat jelöli');
	});
});
