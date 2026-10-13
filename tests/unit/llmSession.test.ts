import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import LLMSession from '$lib/llm/LLMSession';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

// A provider that answers from a script, so the session never reaches a network.
vi.mock('$lib/llm/provider', () => ({
	default: () => ({
		id: 'custom',
		model: 'scripted',
		systemRole: 'system',
		strictTools: false,
		structuredOutputs: true,
		temperature: 0,
		maxTurns: 4,
		client: { chat: { completions: { create } } }
	})
}));

const resultType = z.object({ ok: z.boolean() });

/** One model response. */
function answer(message: Record<string, unknown>) {
	return { choices: [{ message: { role: 'assistant', content: null, ...message } }], usage: {} };
}

function toolCall(id: string, name: string, type = 'function') {
	return { id, type, function: { name, arguments: '{}' } };
}

/** The conversation as the model saw it on its n-th request. */
function messagesOfCall(n: number) {
	return (create.mock.calls[n][0] as { messages: ChatCompletionMessageParam[] }).messages;
}

function newSession() {
	const session = new LLMSession('instructions', resultType);
	session.registerFunction({
		name: 'helyes-e_igy',
		description: 'a tool',
		parameters: z.object({ input: z.string() }),
		callback: async () => ['called']
	});
	session.addMessage({ role: 'user', content: 'tely' });
	return session;
}

/**
 * A made-up tool name used to be thrown as "Misconfigured tool", which ended the session and
 * showed the reader an error for a guess the next turn would have mended. It is the model's
 * mistake, so it is answered where the model is looking: in the tool's own output.
 */
describe('LLMSession tool calls', () => {
	afterEach(() => {
		create.mockReset();
		vi.restoreAllMocks();
	});

	it('answers a made-up tool name with a tool error and lets the session go on', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		create
			.mockResolvedValueOnce(answer({ tool_calls: [toolCall('call_1', 'nincs_ilyen')] }))
			.mockResolvedValueOnce(answer({ content: '{"ok":true}' }));

		await expect(newSession().getResult()).resolves.toEqual({ ok: true });

		const reply = messagesOfCall(1).find((message) => message.role === 'tool');
		expect(reply).toMatchObject({ tool_call_id: 'call_1' });
		expect(String(reply?.content)).toContain('nincs_ilyen');
		// and the names it may use instead
		expect(String(reply?.content)).toContain('helyes-e_igy');
	});

	it('answers an unsupported tool call type the same way', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		create
			.mockResolvedValueOnce(answer({ tool_calls: [toolCall('call_2', 'helyes-e_igy', 'custom')] }))
			.mockResolvedValueOnce(answer({ content: '{"ok":true}' }));

		await expect(newSession().getResult()).resolves.toEqual({ ok: true });

		const reply = messagesOfCall(1).find((message) => message.role === 'tool');
		expect(reply).toMatchObject({ tool_call_id: 'call_2' });
		expect(String(reply?.content)).toContain('custom');
	});
});
