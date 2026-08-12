import { describe, expect, it } from 'vitest';
import optimizeForLLM from '$lib/utils/optimizeForLLM';

/**
 * The strings here are real: they come from the tips helyesiras.mta.hu returns for the
 * fáradság/fáradtság pair, split into lines the way scrapeHelyesEIgy splits them.
 */
describe('optimizeForLLM', () => {
	it('expands the abbreviations the site uses in tips', () => {
		expect(optimizeForLLM('L. még: fáradtság')).toBe('Lásd még: fáradtság');
		expect(optimizeForLLM('Pl.: Edzés után sosem érzett fáradtság lett rajta úrrá.')).toBe(
			'Például: Edzés után sosem érzett fáradtság lett rajta úrrá.'
		);
	});

	it('expands every occurrence, not just the first', () => {
		expect(optimizeForLLM('L. még: egy, L. még: kettő')).toBe('Lásd még: egy, Lásd még: kettő');
	});

	it('says that a bare gloss is a meaning', () => {
		// nothing on the line tells the model these quotes mark a definition
		expect(optimizeForLLM('’fáradozás’')).toBe('Jelentése: ’fáradozás’');
		expect(optimizeForLLM('’egyenlő méretű, egyenlő jogú’')).toBe(
			'Jelentése: ’egyenlő méretű, egyenlő jogú’'
		);
	});

	it('only labels a gloss that is the whole line', () => {
		// a quoted word inside a sentence is being cited, not defined
		const cited = 'A ’fáradozás’ szó nem azonos a fáradtsággal.';
		expect(optimizeForLLM(cited)).toBe(cited);
	});

	it('leaves ordinary rule text alone', () => {
		const rule =
			'A „nyelvtan” főnevet és az „ellenőrző” melléknevet egybeírjuk az alábbi szabály alapján: A jelöletlen tárgyas alárendelői összetételt mindig egybeírjuk.';
		expect(optimizeForLLM(rule)).toBe(rule);
	});

	it('leaves an empty fragment empty', () => {
		expect(optimizeForLLM('')).toBe('');
	});
});
