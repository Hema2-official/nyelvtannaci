import { afterEach, describe, expect, it } from 'vitest';
import { datumokFunction, scrapeDatumok } from '$lib/scraper-new/datumok';
import { scrapeSzamok } from '$lib/scraper-new/szamok';
import { elvalasztasFunction, scrapeElvalasztas } from '$lib/scraper-new/elvalasztas';
import { helyesEIgyFunction, scrapeHelyesEIgy } from '$lib/scraper-new/helyesEIgy';
import { kulonVagyEgybeFunction, scrapeKulonVagyEgybe } from '$lib/scraper-new/kulonVagyEgybe';

/**
 * All of the scraping coverage, against the real site: nothing of MTA's is kept in the
 * repo, so this is the only place the parsers meet actual markup.
 *
 * The site answers 500 to a burst of requests (the scraper's interceptor retries those),
 * so these run one at a time with a pause in between.
 */
const pause = () => new Promise((resolve) => setTimeout(resolve, 1000));

describe.sequential('kulon_vagy_egybe', () => {
	afterEach(pause);

	it('reads a solution with its rule and its rule identifiers', async () => {
		const [result, ...rest] = await scrapeKulonVagyEgybe({ input: 'nyelvtan ellenőrző' });

		expect(rest).toEqual([]);
		expect(result.solution).toBe('nyelvtanellenőrző');

		const [step] = result.possibleExplanations[0].steps;
		expect(step.action).toContain('egybeírjuk');

		expect(step.references.length).toBeGreaterThan(0);
		for (const reference of step.references) expect(reference).toMatch(/^AkH1[12]-\d+[a-z]?$/);
	});

	it('keeps every reading when the site offers more than one', async () => {
		const [result] = await scrapeKulonVagyEgybe({ input: 'helyesírás ellenőrző' });

		expect(result.solution).toBe('helyesírás-ellenőrző');
		expect(result.possibleExplanations.length).toBeGreaterThan(1);

		// the branches reach one spelling by different structures; collapsing them would
		// hide the choice the model is asked to make
		const endings = result.possibleExplanations.map((e) => e.steps.at(-1)?.action);
		expect(new Set(endings).size).toBe(endings.length);
	});

	it('summarises a suggestion as a suggestion, and numbers competing readings', async () => {
		const input = 'mesterséges színezék mentes';
		const results = await scrapeKulonVagyEgybe({ input });

		expect(results.length).toBeGreaterThan(1);
		// the case has to exercise both shapes, or the assertions below prove nothing
		expect(results.some((result) => result.possibleExplanations.length > 1)).toBe(true);
		expect(results.some((result) => result.possibleExplanations.length === 1)).toBe(true);

		const summaries = kulonVagyEgybeFunction.summarize!({ input }, results);

		results.forEach((result, index) => {
			const summary = summaries[index];

			// this tool never judges what it was given, so there is no verdict to report
			expect(summary.correct).toBeUndefined();
			expect(summary.query).toBe(input);
			expect(summary.expression).toBe(result.solution);
			expect(summary.shareLink).toContain('/helyesiras/default/kulegy?q=');

			if (result.possibleExplanations.length > 1)
				expect(summary.explanation).toContain('1. lehetséges elemzés:');
			else expect(summary.explanation).not.toContain('lehetséges elemzés:');
		});
	});

	it('surfaces the message of an input the site refuses', async () => {
		// note: this path rejects with a bare string rather than an Error
		const error = await scrapeKulonVagyEgybe({ input: 'nyelvtan' }).catch((e: unknown) => e);

		expect(String(error)).toContain('legalább 2');
	});
});

describe.sequential('helyes-e_igy', () => {
	afterEach(pause);

	it('flags a misspelling and reports the verdict it does have', async () => {
		const [result] = await scrapeHelyesEIgy({ input: 'tely' });

		expect(result.correct).toBe(false);
		expect(result.suggestions.join(', ')).toContain('tej');

		const [summary] = helyesEIgyFunction.summarize!({ input: 'tely' }, [result]);
		expect(summary.correct).toBe(false);
		expect(summary.shareLink).toContain('/helyesiras/default/suggest?q=');
	});

	it('reads the tips of a correct but easily confused word', async () => {
		const [result] = await scrapeHelyesEIgy({ input: 'egyenlőre' });
		const tips = result.tips.join('\n');

		expect(result.correct).toBe(true);
		// the site's shorthand is expanded on the way out, so the model never has to decode it
		expect(tips).toContain('Lásd még:');
		expect(tips).not.toContain('L. még:');
		expect(tips).toContain('Például:');
		// and the bare gloss line is labelled as the meaning it is
		expect(tips).toMatch(/Jelentése: ’.+’/);
	});

	it('keeps the notice about the input separate from the tips', async () => {
		const [result] = await scrapeHelyesEIgy({ input: 'Nyelvtannaci' });

		// the div[class^="result-"] banner, here pointing at Névkereső
		expect(result.tips).toEqual([]);
		expect(result.notices[0]).toContain('Névkereső');
	});

	it('puts a notice about the whole query on every result it produced', async () => {
		const results = await scrapeHelyesEIgy({ input: 'nyelvtan ellenőrző' });

		expect(results.map((result) => result.expression)).toEqual(['nyelvtan', 'ellenőrző']);
		for (const result of results) expect(result.notices[0]).toContain('Külön vagy egybe?');
	});
});

describe.sequential('datumok', () => {
	afterEach(pause);

	it('lists the plain and the suffixed forms of one date', async () => {
		const results = await scrapeDatumok({ input: '1848-03-15' });
		const forms = results.map((result) => result.form);

		// the two ul.result lists are merged, so both kinds have to be in there
		expect(forms).toContain('1848. március 15.');
		expect(forms).toContain('1848. március 15-én');
		expect(forms).toContain('1848. márc. 15.');

		const suffixed = results.find((result) => result.form === '1848. március 15-én');
		expect(suffixed?.references).toContain('AkH12-298');
		for (const reference of suffixed!.references) expect(reference).toMatch(/^AkH1[12]-/);
	});

	it('rejects a day that does not exist, in the words the site uses', async () => {
		const error = await scrapeDatumok({ input: '2024-02-30' }).catch((e: unknown) => e);

		expect(String(error)).toContain('Hibás dátum');
	});

	it('summarises the whole answer as one row', async () => {
		const results = await scrapeDatumok({ input: '2024-01-01' });

		const summaries = datumokFunction.summarize!({ input: '2024-01-01' }, results);

		expect(summaries).toHaveLength(1);
		expect(summaries[0].correct).toBeUndefined();
		expect(summaries[0].query).toBe('2024-01-01');
		expect(summaries[0].explanation).toContain('2024. január 1-je');
		expect(summaries[0].shareLink).toContain('/helyesiras/default/dates?q=');
	});
});

describe.sequential('szamok', () => {
	afterEach(pause);

	it('spells out a number and flags the non-standard variant', async () => {
		const results = await scrapeSzamok({ input: '2024' });

		expect(results[0].form).toBe('kétezer-huszonnégy');

		const variant = results.find((result) => result.form === 'kettőezer-huszonnégy');
		expect(variant?.note).toBe('Nem része a sztenderd nyelvváltozatnak.');
	});

	it('keeps the note that says when a form is the adjectival one', async () => {
		const results = await scrapeSzamok({ input: '32' });

		const adjectival = results.find((result) => result.form === 'harminckét');
		expect(adjectival?.note).toContain('Jelzői értelemben');
		expect(results.map((result) => result.form)).toContain('harminckettő');
	});

	it('handles fractions and decimals', async () => {
		expect((await scrapeSzamok({ input: '3,5' }))[0].form).toBe('három egész öt tized');
		await pause();
		expect((await scrapeSzamok({ input: '1/2' })).map((r) => r.form)).toContain('egyketted');
	});
});

describe.sequential('elvalasztas', () => {
	afterEach(pause);

	it('returns one entry per word, in the notation the description explains', async () => {
		const results = await scrapeElvalasztas({ input: 'magyar nyelvtan' });

		expect(results).toEqual(['ma-gyar', 'nyelv|-tan']);
	});

	it('reports a suggestion rather than a verdict', async () => {
		const input = 'magyar nyelvtan';
		const results = await scrapeElvalasztas({ input });

		const summaries = elvalasztasFunction.summarize!({ input }, results);

		expect(summaries).toHaveLength(2);
		expect(summaries[0].correct).toBeUndefined();
		expect(summaries[0].query).toBe(input);
		expect(summaries[0].shareLink).toContain('/helyesiras/default/hyph?q=');
	});
});
