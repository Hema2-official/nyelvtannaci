import { describe, expect, it } from 'vitest';
import splitSentences, { joinChunks } from '$lib/logic/splitSentences';

/** The invariant everything else rests on: the split loses nothing. */
function rejoin(input: string) {
	return joinChunks(splitSentences(input));
}

const texts = [
	'Ez egy mondat.',
	'Ez egy mondat. Ez egy másik.',
	'Ez egy mondat!  Ez egy másik?  És egy harmadik...',
	'A vállalat 2024. március 15.-én indította el az új programját. Sokan jelentkeztek.',
	'Perczel Mór 1811. november 11-kén született a tolna megyei Bonyhádon. Följegyezték róla, hogy jól tanult.',
	'A magyar nyelv uráli eredete a XIX. század óta bizonyított tény, melyet Budenz József bizonyított be.',
	'Szabó D. Attila írta a könyvet. Jó lett.',
	'Kb. 20 ember jött el. Kevesen.',
	'J vagy LY? (Pótold a betűt!)\n- gó__a\n- ha__ó',
	'   Bevezető szóköz. És egy második.   ',
	'Nincs pont a végén',
	'',
	'Egy sor\nMásik sor'
];

describe('splitSentences', () => {
	it.each(texts)('rejoins losslessly: %j', (text) => {
		expect(rejoin(text)).toBe(text);
	});

	it('keeps a single sentence in one chunk', () => {
		expect(splitSentences('Ez egy mondat.').map((c) => c.text)).toEqual(['Ez egy mondat.']);
	});

	it('splits on a real sentence boundary', () => {
		expect(splitSentences('Ez jó. Az is jó.').map((c) => c.text)).toEqual(['Ez jó.', 'Az is jó.']);
	});

	it('does not split a date, where the full stop marks an ordinal', () => {
		expect(splitSentences('A vállalat 2024. március 15-én indult.').map((c) => c.text)).toEqual([
			'A vállalat 2024. március 15-én indult.'
		]);
	});

	it('does not split after a roman numeral', () => {
		expect(splitSentences('A XIX. század óta tudjuk.').map((c) => c.text)).toEqual([
			'A XIX. század óta tudjuk.'
		]);
	});

	it('does not split after an initial', () => {
		expect(splitSentences('Szabó D. Attila írta.').map((c) => c.text)).toEqual([
			'Szabó D. Attila írta.'
		]);
	});

	it('does not split after a known abbreviation', () => {
		expect(splitSentences('Sokan jöttek, pl. Attila is.').map((c) => c.text)).toEqual([
			'Sokan jöttek, pl. Attila is.'
		]);
	});

	it('keeps a punctuation cluster with its sentence', () => {
		expect(splitSentences('Tényleg?! Igen.').map((c) => c.text)).toEqual(['Tényleg?!', 'Igen.']);
	});

	it('carries the whitespace between sentences in trailing, not in text', () => {
		const [first] = splitSentences('Ez jó.\n\nAz is jó.');
		expect(first).toEqual({ leading: '', text: 'Ez jó.', trailing: '\n\n' });
	});

	it('treats a worksheet with line breaks as one chunk when nothing ends a sentence', () => {
		const worksheet = 'J vagy LY?\n- gó__a\n- ha__ó';
		expect(splitSentences(worksheet).length).toBe(1);
	});

	it('returns nothing for an empty input', () => {
		expect(splitSentences('   ')).toEqual([]);
	});
});
