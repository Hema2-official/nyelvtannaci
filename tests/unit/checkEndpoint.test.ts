import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { APIConnectionError } from 'openai';
import { POST } from '../../src/routes/api/check/+server';

const { runSession } = vi.hoisted(() => ({ runSession: vi.fn() }));

vi.mock('$lib/llm/runSession', () => ({ default: runSession }));

function post(input: string) {
	const request = new Request('http://localhost/api/check', {
		method: 'POST',
		body: JSON.stringify({ input })
	});
	return POST({ request } as RequestEvent);
}

/** The data of the stream's `error` event. */
async function errorEvent(response: Response) {
	const text = await response.text();
	const chunk = text.split('\n\n').find((part) => part.startsWith('event: error'));
	return JSON.parse(/^data: (.*)$/m.exec(chunk ?? '')?.[1] ?? 'null') as unknown;
}

/**
 * What a failed session tells the reader. The thrown message is for the server log: a
 * provider's names the gateway and its billing state, the session's names tools and turn
 * budgets, and the page shows whatever arrives in the error event word for word.
 */
describe('POST /api/check error events', () => {
	afterEach(() => {
		runSession.mockReset();
		vi.restoreAllMocks();
	});

	it.each([
		[
			'the turn budget',
			new Error('No result returned from the model within 25 turns'),
			['turns', 'No result']
		],
		['the provider', new APIConnectionError({ message: 'Connection error.' }), ['Connection']],
		['a provider error inside a 200', new Error('The provider returned an error'), ['provider']],
		[
			'anything else',
			new Error('Misconfigured tool: nincs_ilyen'),
			['Misconfigured', 'nincs_ilyen']
		]
	])('reports %s in fixed words of its own', async (_label, thrown, internal) => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		runSession.mockRejectedValueOnce(thrown);

		const data = await errorEvent(await post('tely'));

		expect(data).toMatch(/Próbáld újra/);
		for (const word of internal) expect(data).not.toContain(word);
	});

	it('tells the turn budget and a provider failure apart', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});

		runSession.mockRejectedValueOnce(
			new Error('No result returned from the model within 25 turns')
		);
		const turns = await errorEvent(await post('tely'));

		runSession.mockRejectedValueOnce(new APIConnectionError({ message: 'Connection error.' }));
		const provider = await errorEvent(await post('tely'));

		expect(turns).not.toBe(provider);
	});
});
