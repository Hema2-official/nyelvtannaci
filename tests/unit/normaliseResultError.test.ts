import { describe, expect, it } from 'vitest';
import { normalizeResultError } from '$lib/llm/promptConfig';

/**
 * The case this exists for is real: MiMo-V2.6-Flash returned `"error": "null"` in all
 * thirteen sessions of a 2026-09-22 run, every correction in them correct, and the bench
 * suite reported thirteen failures reading "session reported an error: null".
 */
describe('normalizeResultError', () => {
	it('turns the word a model writes instead of the value into a real null', () => {
		expect(normalizeResultError('null')).toBe(null);
		expect(normalizeResultError('undefined')).toBe(null);
		expect(normalizeResultError('NULL')).toBe(null);
	});

	it('treats an empty or blank field as no error', () => {
		expect(normalizeResultError('')).toBe(null);
		expect(normalizeResultError('   ')).toBe(null);
		expect(normalizeResultError(null)).toBe(null);
		expect(normalizeResultError(undefined)).toBe(null);
	});

	it('keeps a real error message, trimmed', () => {
		expect(normalizeResultError('A javítás nem készült el.')).toBe('A javítás nem készült el.');
		expect(normalizeResultError('  a tool nem válaszolt  ')).toBe('a tool nem válaszolt');
	});

	it('keeps a message that merely mentions null', () => {
		expect(normalizeResultError('a null érték nem értelmezhető')).toBe(
			'a null érték nem értelmezhető'
		);
	});
});
