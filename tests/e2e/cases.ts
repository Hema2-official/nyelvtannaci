import type { Result } from '$lib/llm/promptConfig';

export type CorrectionCase = {
	/**
	 * Keep this under ~37 characters. Vitest truncates the interpolated part of a test
	 * title, and `-t` matches the truncated string, so a longer name cannot be filtered
	 * on by its tail.
	 */
	name: string;
	input: string;
	/** What the parts have to add up to once the removed ones are dropped. */
	expected: string;
	/**
	 * True when the prompt's own Examples section already contains this input. Those cases
	 * measure whether a model follows instructions it can see; the rest measure whether it
	 * can do the job. Keep both, and read the two groups separately.
	 */
	inPrompt: boolean;
	/** Why this is the right answer, for whoever reads a failure. */
	note: string;
};

export const correctionCases: CorrectionCase[] = [
	{
		name: 'coordination: nyelvtanellenőrző',
		input: 'Magyar helyesírás- és nyelvtan-ellenőrző',
		expected: 'Magyar helyesírás- és nyelvtanellenőrző',
		inPrompt: true,
		note: '"helyesírás-ellenőrző" earns its hyphen on syllable count, "nyelvtanellenőrző" does not; dropping the shared utótag from the first member does not change the second.'
	},
	{
		name: 'mentes list',
		input: 'Mesterséges színezék, parabén és szilikon mentes!',
		expected: 'Mesterségesszínezék-, parabén- és szilikonmentes!',
		inPrompt: true,
		note: 'The tool suggests "mesterséges színezékmentes" and "mesterséges-színezékmentes"; neither matches the meaning, which is "mentes a mesterséges színezéktől".'
	},
	{
		name: 'testre szabás',
		input: 'testre szabás',
		expected: 'testreszabás',
		inPrompt: true,
		note: 'A fogalom, not an occasional action.'
	},
	{
		name: 'testreszabott',
		input: 'testreszabott',
		expected: 'testre szabott',
		inPrompt: true,
		note: 'Melléknévi igenév: the members keep their own meaning.'
	},
	{
		name: 'tely',
		input: 'tely',
		expected: 'tej',
		inPrompt: true,
		note: 'Plain misspelling, helyes-e_igy suggests it directly.'
	},
	{
		name: 'coordination: versenyek',
		input: 'Részt veszek informatikai, irodalom és matekversenyeken',
		expected: 'Részt veszek informatikai, irodalom- és matekversenyeken',
		inPrompt: true,
		note: '"informatikai verseny" stays separate, "irodalomverseny" and "matekverseny" are compounds, so only the middle member takes the hyphen. Whether the model closes the sentence with a full stop is ignored by the comparison.'
	},
	{
		name: 'unseen: számítógépprogram',
		input: 'Elindítottam a számítógép programot.',
		expected: 'Elindítottam a számítógépprogramot.',
		inPrompt: false,
		note: 'kulon_vagy_egybe on "számítógép program" gives "számítógépprogram"; the model has to strip the -ot suffix before asking.'
	},
	{
		name: 'unseen: visszatérek',
		input: 'Holnap vissza térek a könyvtárba.',
		expected: 'Holnap visszatérek a könyvtárba.',
		inPrompt: false,
		note: 'Igekötő + ige written together, confirmed by kulon_vagy_egybe.'
	},
	{
		name: 'unseen: kissebb',
		input: 'Ez a doboz kissebb, mint a másik.',
		expected: 'Ez a doboz kisebb, mint a másik.',
		inPrompt: false,
		note: 'helyes-e_igy rejects "kissebb" and suggests "kisebb" first.'
	},
	{
		name: 'unseen: munkaerő-piaci',
		input: 'Rossz a munkaerőpiaci helyzet.',
		expected: 'Rossz a munkaerő-piaci helyzet.',
		inPrompt: false,
		note: 'Same shape as the önéletrajz-alkotási example in the prompt, different word. kulon_vagy_egybe on "munkaerő piaci" offers both "munkaerő-piaci" and "munkaerőpiaci" and explains neither by length; only measuring decides. elvalasztas gives "mun-ka|-e-rő|-pi-a-ci": three members, seven syllables, so the hyphen is required. The noun is the counter-case that makes it easy to get wrong: "munkaerőpiac" is six syllables and stays solid.'
	},
	{
		name: 'unseen: date suffix',
		input: 'Az ünnep 1848. március 15.-én van.',
		expected: 'Az ünnep 1848. március 15-én van.',
		inPrompt: false,
		note: 'A day already followed by a dot does not also take a dot before its suffix. datumok on "1848-03-15" lists "1848. március 15-én" and never the dotted form. Days ending in 1 are deliberately avoided here: for those AkH allows both "1-jén" and "1-én", so there would be no single right answer.'
	},
	{
		name: 'unseen: number hyphen',
		input: 'Kétezerhuszonnégy nyarán költöztünk.',
		expected: 'Kétezer-huszonnégy nyarán költöztünk.',
		inPrompt: false,
		note: 'Written out in letters, a number above 2000 is broken with a hyphen at the thousand boundary. szamok on "2024" gives "kétezer-huszonnégy"; the model has to recognise the letters as a number first, and ask with digits.'
	},
	{
		name: 'unseen: leave a correct sentence alone',
		input: 'Aláírtunk egy hosszú távú szerződést.',
		expected: 'Aláírtunk egy hosszú távú szerződést.',
		inPrompt: false,
		note: 'kulon_vagy_egybe returns "hosszú távú szerződés" unchanged. This is the false-positive control: a model that hyphenates everything fails here.'
	}
];

/**
 * Punctuation is out of scope for the checker, so the comparison ignores what sits at the
 * very end: a model that adds a missing full stop, or leaves one off, is neither right nor
 * wrong here. Everything inside the text — hyphens, commas, spelling — still has to match
 * exactly, since that is what the cases are about.
 */
export function comparableText(text: string): string {
	return text
		.trimEnd()
		.replace(/[.!?…]+$/u, '')
		.trimEnd();
}

/**
 * The corrected text as the user reads it. Removed parts are dropped: the schema says the
 * parts concatenate to the corrected text, which cannot also include what was taken out.
 */
export function correctedText(result: Result): string {
	return result.resultParts
		.filter((part) => part.type !== 'removed')
		.map((part) => part.text)
		.join('');
}

/** Schema rules that hold whatever the input was. */
export function conformanceProblem(result: Result): string | undefined {
	if (result.error) return `session reported an error: ${result.error}`;

	if (result.resultParts.length === 0) return 'no result parts';

	const explained = result.resultParts.find(
		(part) => part.type === 'original' && part.explanation.trim()
	);
	if (explained) return `original part carries an explanation: "${explained.text}"`;

	const empty = result.resultParts.find((part) => part.text === '');
	if (empty) return 'a result part has empty text';

	return undefined;
}
