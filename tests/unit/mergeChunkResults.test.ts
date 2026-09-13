import { describe, expect, it } from 'vitest';
import mergeChunkResults, {
	mergeAdjacentOriginals,
	originalPart
} from '$lib/logic/mergeChunkResults';
import splitSentences, { joinChunks } from '$lib/logic/splitSentences';
import type { Result } from '$lib/llm/promptConfig';

const untouched = (text: string): Result => ({
	error: null,
	resultParts: [originalPart(text)],
	alternatives: []
});

const joined = (result: Result) =>
	result.resultParts
		.filter((part) => part.type !== 'removed')
		.map((part) => part.text)
		.join('');

describe('mergeChunkResults', () => {
	it('gives back the input exactly when no sentence was changed', () => {
		const input = 'Ez jó.  Az is jó.\n\nÉs a harmadik is.';
		const chunks = splitSentences(input);
		expect(joinChunks(chunks)).toBe(input);

		const merged = mergeChunkResults(
			chunks,
			chunks.map((chunk) => untouched(chunk.text))
		);
		expect(joined(merged)).toBe(input);
	});

	it('keeps the whitespace between sentences, which never went to the model', () => {
		const input = 'Ez jó.\n\nAz is jó.';
		const chunks = splitSentences(input);
		const merged = mergeChunkResults(chunks, [
			{ error: null, resultParts: [originalPart('Ez jó.')], alternatives: [] },
			{ error: null, resultParts: [originalPart('Az is jó.')], alternatives: [] }
		]);
		expect(joined(merged)).toBe(input);
	});

	it('carries a correction from one sentence into the whole', () => {
		const input = 'A kutató intézet jó. Az is jó.';
		const chunks = splitSentences(input);
		const merged = mergeChunkResults(chunks, [
			{
				error: null,
				alternatives: [],
				resultParts: [
					{ text: 'A ', type: 'original', explanation: '', references: [] },
					{ text: 'kutatóintézet', type: 'corrected', explanation: 'egybe', references: [] },
					{ text: ' jó.', type: 'original', explanation: '', references: [] }
				]
			},
			untouched('Az is jó.')
		]);
		expect(joined(merged)).toBe('A kutatóintézet jó. Az is jó.');
		expect(merged.resultParts.filter((part) => part.type === 'corrected')).toHaveLength(1);
	});

	it('collects the errors of the sentences that failed', () => {
		const chunks = splitSentences('Ez jó. Az is jó.');
		const merged = mergeChunkResults(chunks, [
			{ error: 'timeout', resultParts: [originalPart('Ez jó.')], alternatives: [] },
			untouched('Az is jó.')
		]);
		expect(merged.error).toBe('timeout');
	});

	it('falls back to the untouched sentence when a chunk produced nothing', () => {
		const chunks = splitSentences('Ez jó. Az is jó.');
		const merged = mergeChunkResults(chunks, [
			undefined as unknown as Result,
			untouched('Az is jó.')
		]);
		expect(joined(merged)).toBe('Ez jó. Az is jó.');
	});

	it('preserves leading and trailing whitespace of the whole text', () => {
		const input = '  Ez jó. Az is jó.  ';
		const chunks = splitSentences(input);
		const merged = mergeChunkResults(
			chunks,
			chunks.map((chunk) => untouched(chunk.text))
		);
		expect(joined(merged)).toBe(input);
	});
});

describe('mergeAdjacentOriginals', () => {
	it('joins untouched neighbours so the seam does not show', () => {
		const merged = mergeAdjacentOriginals([
			originalPart('Ez jó.'),
			originalPart(' '),
			originalPart('Az is.')
		]);
		expect(merged).toHaveLength(1);
		expect(merged[0].text).toBe('Ez jó. Az is.');
	});

	it('does not swallow a part that carries an explanation', () => {
		const explained = {
			text: 'Ez jó.',
			type: 'original' as const,
			explanation: 'szándékos',
			references: []
		};
		expect(mergeAdjacentOriginals([explained, originalPart(' Az is.')])).toHaveLength(2);
	});

	it('leaves corrected parts standing on their own', () => {
		const parts = [
			originalPart('A '),
			{ text: 'kutatóintézet', type: 'corrected' as const, explanation: '', references: [] },
			originalPart(' jó.')
		];
		expect(mergeAdjacentOriginals(parts)).toHaveLength(3);
	});
});
