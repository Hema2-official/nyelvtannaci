import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { POST } from '../../src/routes/api/check/+server';
import type { Result } from '$lib/llm/promptConfig';

/**
 * Everything else drives runSession directly, which skips the layer the browser actually
 * talks to: the SSE framing, the event names the page listens for, and the error path.
 * One cheap correction is enough to exercise all three.
 */
function post(body: unknown) {
	const request = new Request('http://localhost/api/check', {
		method: 'POST',
		body: JSON.stringify(body)
	});
	return POST({ request } as RequestEvent);
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

	it('rejects a request with no input, without opening a stream', async () => {
		const response = await post({});

		expect(response.status).toBe(500);
		expect(await response.text()).toContain('No input specified');
	});
});
