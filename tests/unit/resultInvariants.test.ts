import { describe, expect, it } from 'vitest';
import checkResultInvariants, { joinParts } from '$lib/logic/resultInvariants';
import type { Result } from '$lib/llm/promptConfig';

type PartInput = [text: string, type: Result['resultParts'][number]['type']];

function result(...parts: PartInput[]): Result {
	return {
		error: '',
		alternatives: [],
		resultParts: parts.map(([text, type]) => ({ text, type, explanation: '', references: [] }))
	};
}

describe('joinParts', () => {
	it('drops removed parts, since the reader never sees them', () => {
		const joined = joinParts(
			result(['Ez ', 'original'], ['a fölösleg ', 'removed'], ['jó.', 'corrected'])
		);
		expect(joined).toBe('Ez jó.');
	});
});

describe('checkResultInvariants', () => {
	const input = 'A kutató intézet munkatársai jól dolgoznak.';

	it('accepts a well-formed correction', () => {
		const problem = checkResultInvariants(
			input,
			result(
				['A ', 'original'],
				['kutatóintézet', 'corrected'],
				[' munkatársai jól dolgoznak.', 'original']
			)
		);
		expect(problem).toBeUndefined();
	});

	it('accepts an untouched input', () => {
		expect(checkResultInvariants(input, result([input, 'original']))).toBeUndefined();
	});

	it('rejects an empty parts list', () => {
		expect(checkResultInvariants(input, result())).toMatch(/no parts/i);
	});

	it('rejects a part with empty text', () => {
		expect(checkResultInvariants(input, result([input, 'original'], ['', 'corrected']))).toMatch(
			/empty text/i
		);
	});

	it('rejects a corrected part padded with spaces, which the reader sees highlighted', () => {
		const problem = checkResultInvariants(
			input,
			result(
				['A', 'original'],
				[' kutatóintézet ', 'corrected'],
				['munkatársai jól dolgoznak.', 'original']
			)
		);
		expect(problem).toMatch(/starts or ends with a space/i);
	});

	it('leaves an original part with spaces alone, because the input had them', () => {
		expect(
			checkResultInvariants(
				input,
				result(
					['A ', 'original'],
					['kutatóintézet', 'corrected'],
					[' munkatársai jól dolgoznak.', 'original']
				)
			)
		).toBeUndefined();
	});

	it('rejects an original part that is not a straight quote from the input', () => {
		const problem = checkResultInvariants(
			input,
			result(['A kutatóintézet munkatársai jól dolgoznak.', 'original'])
		);
		expect(problem).toMatch(/marked original/i);
	});

	// the measured defect: "belőle.Apja", where the space between two parts went missing
	it('rejects a full stop glued to the next sentence', () => {
		const twoSentences = 'Ez jó. Az is jó.';
		const problem = checkResultInvariants(
			twoSentences,
			result(['Ez jó.', 'original'], ['Az is jó.', 'original'])
		);
		expect(problem).toMatch(/space lost/i);
	});

	it('allows a full stop glued to a letter when the input already had one', () => {
		const abbreviated = 'A pl.az rövidítés hibás.';
		expect(checkResultInvariants(abbreviated, result([abbreviated, 'original']))).toBeUndefined();
	});

	it('does not fire on a date, where the full stop is followed by a space', () => {
		const dated = 'Az ünnep 1848. március 15.-én van.';
		const problem = checkResultInvariants(
			dated,
			result(['Az ünnep 1848. március ', 'original'], ['15-én', 'corrected'], [' van.', 'original'])
		);
		expect(problem).toBeUndefined();
	});

	it('rejects a double space introduced at a part boundary', () => {
		const problem = checkResultInvariants(
			input,
			result(
				['A ', 'original'],
				[' kutatóintézet', 'added'],
				[' munkatársai jól dolgoznak.', 'original']
			)
		);
		// the padding check catches this one first, which is the more useful complaint
		expect(problem).toMatch(/space/i);
	});

	it('names every mangled quote at once, not just the first', () => {
		const problem = checkResultInvariants(
			input,
			result(
				['A kutató ', 'original'],
				['intezet ', 'original'],
				['munkatarsai jól dolgoznak.', 'original']
			)
		);
		expect(problem).toContain('"intezet "');
		expect(problem).toContain('"munkatarsai jól dolgoznak."');
		expect(problem).toMatch(/These 2 parts/);
	});

	it('rejects a clause that vanished from a short input', () => {
		// measured: this exact input came back as "Ez a doboz kisebb", the rest in no part at all
		const problem = checkResultInvariants(
			'Ez a doboz kissebb, mint a másik.',
			result(['Ez a doboz ', 'original'], ['kisebb', 'corrected'])
		);
		expect(problem).toMatch(/left out/i);
	});

	it('rejects a result that lost most of a long input', () => {
		const long =
			'A kutató intézet munkatársai jól dolgoznak, és az eredményeiket minden évben közzéteszik a saját kiadványukban is, amelyet az egyetem könyvtára is megőriz.';
		const problem = checkResultInvariants(
			long,
			result(['A ', 'original'], ['kutatóintézet', 'corrected'])
		);
		expect(problem).toMatch(/left out/i);
	});

	// the measured defect: complaining about length here made the model pad "tej" out to "telyj"
	it('does not call a short correction a loss, however much of the word it changes', () => {
		expect(checkResultInvariants('tely', result(['tej', 'corrected']))).toBeUndefined();
		expect(
			checkResultInvariants('testreszabott', result(['testre szabott', 'corrected']))
		).toBeUndefined();
	});

	it('does not count removed parts as loss, since removing is legitimate', () => {
		const withFiller = 'Ez a a mondat jó, és elég hosszú ahhoz, hogy a hányados ne essen le.';
		const problem = checkResultInvariants(
			withFiller,
			result(
				['Ez a ', 'original'],
				['a ', 'removed'],
				['mondat jó, és elég hosszú ahhoz, hogy a hányados ne essen le.', 'original']
			)
		);
		expect(problem).toBeUndefined();
	});
});
