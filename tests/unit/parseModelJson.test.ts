import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import parseModelJson, { escapeStrayQuotes } from '$lib/llm/parseModelJson';
import { resultType } from '$lib/llm/promptConfig';

/**
 * The fixtures are tool calls copied verbatim from session-logs/. In each of the first two the
 * model meant something unambiguous and the strict parse refused it, at the cost of a turn -
 * ten turns in a row, in Mercury's case.
 */

/** Mercury 2.5, "testre szabás", 2026-09-23: the first of ten calls shaped like this. */
const mercuryEncodedParts = String.raw`{"error": null, "resultParts": "[{\"text\": \"testreszabás\", \"type\": \"corrected\", \"explanation\": \"A „testre szabás\" állandósult szókapcsolat -ás/-és képzős összetétele hagyományosan egybeírandó (AkH11-125d).\", \"references\": [\"AkH11-125d\"]}]", "alternatives": []}`;

/** Ling 3.0 Flash, "testre szabás", 2026-09-23. */
const lingBareQuotes = String.raw`{"error": "null", "resultParts": [{"text": "testreszabás", "type": "corrected", "explanation": "A „testre" főnevet és a „szabás" főnevet egybeírjuk, mert az állandósult szókapcsolatokból -ás képzővel képzett összetételek hagyományosan egybeírandók (AkH11-125d). Két tagból áll, négy szótag, tehát nem igényel kötőjelet.", "references": ["AkH11-125d"]}], "alternatives": []}`;

/** DeepSeek V4 Flash, 2026-09-08: it lost its place mid-string, and nothing here is recoverable. */
const deepseekGarbled = String.raw`{"resultParts": [{"text": "A Nyugati-pályaudvar mellett találkozunk.", "type": "original"riginal\", \"explanation\": \"A „Nyugati\" itt a budapesti pályaudvar tulajdonneve, nem a „nyugati\" melléknév; az egy szavas tulajdonnév és a köznév kötőjellel kapcsolódik, így a formája helyes.\", \"references\": []}]", "error": "", "alternatives": []}`;

const inputSchema = z.object({ input: z.string() });

function syntaxErrorOf(text: string) {
	try {
		JSON.parse(text);
	} catch (error: unknown) {
		return (error as Error).message;
	}
	throw new Error('expected the text not to parse');
}

describe('parseModelJson', () => {
	it('decodes an array sent as a string, bare quote and all', () => {
		expect(() => resultType.parse(JSON.parse(mercuryEncodedParts))).toThrow(
			'expected array, received string'
		);

		const result = parseModelJson(resultType, mercuryEncodedParts);
		expect(result.resultParts).toEqual([
			{
				text: 'testreszabás',
				type: 'corrected',
				explanation:
					'A „testre szabás" állandósult szókapcsolat -ás/-és képzős összetétele hagyományosan egybeírandó (AkH11-125d).',
				references: ['AkH11-125d']
			}
		]);
		expect(result.alternatives).toEqual([]);
	});

	it('reads a call whose Hungarian quotes close with a bare ASCII quote', () => {
		expect(() => JSON.parse(lingBareQuotes)).toThrow(SyntaxError);

		const [part] = parseModelJson(resultType, lingBareQuotes).resultParts;
		expect(part.explanation).toMatch(/^A „testre" főnevet és a „szabás" főnevet egybeírjuk, mert/);
		expect(part.references).toEqual(['AkH11-125d']);
	});

	it('decodes an encoded array nested inside an encoded array', () => {
		const part = { text: 'tej', type: 'corrected', explanation: '', references: '["AkH12-1"]' };
		const text = JSON.stringify({
			error: null,
			resultParts: JSON.stringify([part]),
			alternatives: '[]'
		});

		expect(parseModelJson(resultType, text)).toEqual({
			error: null,
			resultParts: [{ ...part, references: ['AkH12-1'] }],
			alternatives: []
		});
	});

	it('decodes arguments that were encoded as a whole', () => {
		const text = JSON.stringify(JSON.stringify({ input: 'tely' }));
		expect(parseModelJson(inputSchema, text)).toEqual({ input: 'tely' });
	});

	it('leaves JSON-looking text alone where the schema wants a string', () => {
		expect(parseModelJson(inputSchema, '{"input": "[1, 2]"}')).toEqual({ input: '[1, 2]' });
	});

	it('keeps the schema error when a string is not the array the schema wants', () => {
		const text = '{"error": null, "resultParts": "tej", "alternatives": []}';
		expect(() => parseModelJson(resultType, text)).toThrow('expected array, received string');
	});

	it('reports a call the repair cannot save as the model sent it', () => {
		expect(escapeStrayQuotes(deepseekGarbled)).not.toBe(deepseekGarbled);
		expect(() => parseModelJson(resultType, deepseekGarbled)).toThrow(
			syntaxErrorOf(deepseekGarbled)
		);
	});
});

describe('escapeStrayQuotes', () => {
	it('never changes JSON that already parses', () => {
		expect(escapeStrayQuotes(mercuryEncodedParts)).toBe(mercuryEncodedParts);

		const valid = JSON.stringify({ a: 'x', b: ['y', true, null, -1, { c: '„z”' }], d: '' });
		expect(escapeStrayQuotes(valid)).toBe(valid);
	});

	it('does not end a string at a bare quote followed by prose', () => {
		const text = '{"explanation": "a „tej", nem a „tely": az „ly" itt „j"."}';
		expect(JSON.parse(escapeStrayQuotes(text))).toEqual({
			explanation: 'a „tej", nem a „tely": az „ly" itt „j".'
		});
	});
});
