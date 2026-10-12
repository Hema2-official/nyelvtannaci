import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { POST } from '../../src/routes/api/check/+server';
import type { Result } from '$lib/llm/promptConfig';
import { maxInputLength } from '$lib/utils/limits';

/**
 * Everything else drives runSession directly, which skips the layer the browser actually
 * talks to: the SSE framing, the event names the page listens for, and the error path.
 * One cheap correction is enough to exercise all three.
 */
function postRaw(body: string) {
	const request = new Request('http://localhost/api/check', { method: 'POST', body });
	return POST({ request } as RequestEvent);
}

function post(body: unknown) {
	return postRaw(JSON.stringify(body));
}

/** Parse an SSE body into [event, data] pairs. */
async function readEvents(response: Response) {
	const text = await response.text();
	return text
		.split('\n\n')
		.filter(Boolean)
		.map((chunk) => {
			const event = /^event: (.*)$/m.exec(chunk)?.[1] ?? '';
			const data = /^data: (.*)$/m.exec(chunk)?.[1] ?? '';
			return [event, data] as const;
		});
}

describe.sequential('POST /api/check', () => {
	it('streams the analysis and then exactly one result', async () => {
		const response = await post({ input: 'tely' });

		expect(response.headers.get('Content-Type')).toBe('text/event-stream');

		const events = await readEvents(response);
		const names = events.map(([event]) => event);

		expect(names).toContain('init');
		expect(names).toContain('intermediate');
		expect(names.filter((name) => name === 'result')).toHaveLength(1);
		expect(names).not.toContain('error');

		// the page reads intermediates as an array of summaries, and the result as a Result
		const [, intermediate] = events.find(([event]) => event === 'intermediate')!;
		expect(Array.isArray(JSON.parse(intermediate))).toBe(true);

		const [, result] = events.find(([event]) => event === 'result')!;
		const parsed = JSON.parse(result) as Result;
		expect(parsed.resultParts.map((part) => part.text).join('')).toBe('tej');

		// init has to arrive before intermediates, and intermediates before the result
		expect(names.indexOf('init')).toBeLessThan(names.indexOf('intermediate'));
		expect(names.indexOf('intermediate')).toBeLessThan(names.indexOf('result'));
	}, 600_000);

	// None of the rejections below reach the model: they cost no tokens and need no network.

	it('rejects a request with no input, without opening a stream', async () => {
		const response = await post({});

		expect(response.status).toBe(400);
		expect(response.headers.get('Content-Type')).not.toBe('text/event-stream');
		expect(await response.text()).toBe('Nincs ellenőrizendő szöveg.');
	});

	// The length check alone let every one of these through: an array has a length, and so
	// does an object that says it has one.
	it.each([
		['whitespace only', { input: ' \n\t ' }],
		['an array', { input: ['tely'] }],
		['a number', { input: 42 }],
		['an object with a length', { input: { length: 4 } }],
		['null', { input: null }]
	])('rejects %s as input', async (_, body) => {
		const response = await post(body);

		expect(response.status).toBe(400);
		expect(await response.text()).toBe('Nincs ellenőrizendő szöveg.');
	});

	it('rejects a body that is not JSON', async () => {
		const response = await postRaw('tely');

		expect(response.status).toBe(400);
		expect(await response.text()).toBe('Érvénytelen kérelem.');
	});

	it('rejects an input over the limit with 413', async () => {
		const response = await post({ input: 'a'.repeat(maxInputLength + 1) });

		expect(response.status).toBe(413);
	});
});
