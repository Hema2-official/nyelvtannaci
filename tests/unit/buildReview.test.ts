import { describe, expect, it } from 'vitest';
import buildReview from '$lib/llm/buildReview';
import type { Result } from '$lib/llm/promptConfig';

const result: Result = {
	error: '',
	alternatives: [],
	resultParts: [
		{ text: 'A ', type: 'original', explanation: '', references: [] },
		{ text: 'kutatóintézet', type: 'corrected', explanation: 'egybeírandó', references: [] },
		{ text: ' jól dolgozik.', type: 'original', explanation: '', references: [] },
		{ text: ' Fölösleg.', type: 'removed', explanation: 'ismétlés', references: [] }
	]
};

describe('buildReview', () => {
	const review = buildReview('A kutató intézet jól dolgozik. Fölösleg.', result);

	it('shows the joined text, which is the form the model has not seen', () => {
		expect(review).toContain('YOUR RESULT: A kutatóintézet jól dolgozik.');
	});

	it('shows the original next to it', () => {
		expect(review).toContain('ORIGINAL: A kutató intézet jól dolgozik. Fölösleg.');
	});

	it('leaves removed parts out of the joined text, as the reader sees it', () => {
		expect(review).not.toContain('YOUR RESULT: A kutatóintézet jól dolgozik. Fölösleg.');
	});

	it('closes the checklist rather than inviting a fresh review', () => {
		expect(review).toContain('these four things only');
		expect(review).toContain('Do not look for new corrections here');
	});
});
