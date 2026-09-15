import { afterEach, describe, expect, it } from 'vitest';
import { datumokFunction, scrapeDatumok } from '$lib/scraper-new/datumok';
import { scrapeSzamok } from '$lib/scraper-new/szamok';
import { elvalasztasFunction, scrapeElvalasztas } from '$lib/scraper-new/elvalasztas';
import { helyesEIgyFunction, scrapeHelyesEIgy } from '$lib/scraper-new/helyesEIgy';
import { kulonVagyEgybeFunction, scrapeKulonVagyEgybe } from '$lib/scraper-new/kulonVagyEgybe';
import { nevkeresoFunction, scrapeNevkereso } from '$lib/scraper-new/nevkereso';

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

describe.sequential('kulon_vagy_egybe enrichment', () => {
	afterEach(pause);

	it('re-asks a solution the site returned without reasoning', async () => {
		// asked the way the input spells it, the correct branch comes back bare and the wrong one
		// explained - the shape that had this case failing 4/12
		const results = await scrapeKulonVagyEgybe({ input: 'légiforgalmi társaság' });
		const correct = results.find((result) => result.solution === 'légi forgalmi társaság');

		expect(correct).toBeDefined();
		const steps = correct!.possibleExplanations.flatMap((explanation) => explanation.steps);
		expect(steps.length).toBeGreaterThan(0);
		expect(steps.map((step) => step.action).join(' ')).toContain('AkH12');
	});

	it('marks a spelling the 12th edition dropped', async () => {
		const results = await scrapeKulonVagyEgybe({ input: 'cserben hagy' });

		expect(results.find((result) => result.solution === 'cserbenhagy')?.outdated).toBe(true);
		expect(results.find((result) => result.solution === 'cserben hagy')?.outdated).toBeUndefined();
	});

	it('does not re-ask a single joined token, which the site answers not at all', async () => {
		// both branches come back bare here and no re-query can fix it: "rosszulesett" on its own
		// is "(no result)". The scraper has to leave it rather than throw the answer away.
		const results = await scrapeKulonVagyEgybe({ input: 'rosszul esett' });

		expect(results.map((result) => result.solution)).toContain('rosszulesett');
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

	it('answers the edition question the site actually answers', async () => {
		// the pair CLAUDE.md is written around, and the one the parser used to flatten
		const [dropped] = await scrapeHelyesEIgy({ input: 'munkaerő-piaci' });
		await pause();
		const [current] = await scrapeHelyesEIgy({ input: 'munkaerőpiaci' });

		expect(dropped.correct).toBe(false);
		expect(dropped.editions).toBe('AkH11 szerint: helyes, AkH12 szerint: ismeretlen');
		expect(dropped.suggestions).toContain('munkaerőpiaci');

		expect(current.correct).toBe(true);
		expect(current.editions).toBe('AkH11 szerint: ismeretlen, AkH12 szerint: helyes');

		// and the reason reaches the reader, not just the model
		const [summary] = helyesEIgyFunction.summarize!({ input: 'munkaerő-piaci' }, [dropped]);
		expect(summary.explanation).toBe(dropped.editions);
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
		const forms = [...results.simpleForms, ...results.specialForms.map((sf) => sf.form)];

		// the two ul.result lists are merged, so both kinds have to be in there
		expect(forms).toContain('1848. március 15.');
		expect(forms).toContain('1848. március 15-én');
		expect(forms).toContain('1848. márc. 15.');
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

		expect(results.simpleForms[0]).toBe('kétezer-huszonnégy');

		const variant = results.specialForms.find((sf) => sf.form === 'kettőezer-huszonnégy');
		expect(variant?.note).toBe('Nem része a sztenderd nyelvváltozatnak.');
	});

	it('keeps the note that says when a form is the adjectival one', async () => {
		const results = await scrapeSzamok({ input: '32' });

		const adjectival = results.specialForms.find((sf) => sf.form === 'harminckét');
		expect(adjectival?.note).toContain('Jelzői értelemben');
		expect(results.simpleForms).toContain('harminckettő');
	});

	it('handles fractions and decimals', async () => {
		expect((await scrapeSzamok({ input: '3,5' })).simpleForms[0]).toBe('három egész öt tized');
		await pause();
		expect((await scrapeSzamok({ input: '1/2' })).specialForms.map((sf) => sf.form)).toContain(
			'egyketted'
		);
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

describe.sequential('nevkereso', () => {
	afterEach(pause);

	it('answers a wrongly written name with the spelling the register holds', async () => {
		const result = await scrapeNevkereso({ input: 'Petőfi-híd' });

		// the register's index is blind to the hyphen, so the query finds its own letters
		expect(result.matches[0]).toEqual({
			name: 'Petőfi híd',
			sameLetters: true,
			categories: ['tulajdonnév', 'földrajzi név']
		});

		// the rest are longer names starting the same way, and answer a different question
		expect(result.matches.slice(1).every((match) => match.sameLetters === undefined)).toBe(true);
	});

	it('restores case, accents and a hyphen at once', async () => {
		const result = await scrapeNevkereso({ input: 'ujzeland' });

		expect(result.matches[0].name).toBe('Új-Zéland');
		expect(result.matches[0].categories).toContain('országnév');
	});

	it('returns nothing for a name the register does not have', async () => {
		// the register is names, and hardly any institution names at that
		expect(await scrapeNevkereso({ input: 'Nyugati pályaudvar' })).toEqual({ matches: [] });
	});

	it('keeps both spellings when the register holds two of the same letters', async () => {
		const result = await scrapeNevkereso({ input: 'Margit-sziget' });

		const marked = result.matches.filter((match) => match.sameLetters);
		expect(marked.map((match) => match.name)).toEqual(['Margit-sziget', 'Margitsziget']);
		// the categories are the only thing telling the island from the settlement
		expect(marked[0].categories).toContain('természetföldrajzi név');
		expect(marked[1].categories).toContain('településnév');
	});

	it('reports what it left out instead of truncating in silence', async () => {
		const result = await scrapeNevkereso({ input: 'a' });

		expect(result.matches).toHaveLength(10);
		expect(result.more).toBeGreaterThan(0);
	});

	it('summarises the register answer as a spelling, with a link a reader can open', async () => {
		const input = 'Petőfi-híd';
		const [summary] = nevkeresoFunction.summarize!({ input }, await scrapeNevkereso({ input }));

		expect(summary.expression).toBe('Petőfi híd');
		expect(summary.correct).toBe(false);
		expect(summary.explanation).toBe('tulajdonnév, földrajzi név');
		expect(summary.shareLink).toContain('/helyesiras/default/predict?q=');
	});

	it('calls a name right when the register spells it that way among others', async () => {
		// "Margitsziget" is not the first entry the register returns, and is still correct
		const input = 'Margitsziget';
		const [summary] = nevkeresoFunction.summarize!({ input }, await scrapeNevkereso({ input }));

		expect(summary.correct).toBe(true);
		expect(summary.expression).toBe('Margitsziget');
		expect(summary.explanation).toContain('Margit-sziget');
	});

	it('reports a miss as a miss rather than as a verdict', async () => {
		const input = 'Nyugati pályaudvar';
		const [summary] = nevkeresoFunction.summarize!({ input }, await scrapeNevkereso({ input }));

		expect(summary.expression).toBe('nincs találat');
		expect(summary.correct).toBeUndefined();
	});
});
