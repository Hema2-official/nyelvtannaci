import { describe, expect, it } from 'vitest';
import type { ChatCompletionTool } from 'openai/resources/index.mjs';
import { toChatCompletionTool, toParameterSchema } from '$lib/llm/toolSchema';
import { kulonVagyEgybeFunction } from '$lib/scraper-new/kulonVagyEgybe';
import { resultType } from '$lib/llm/promptConfig';

/** Walk into a JSON schema without reaching for `any`. */
function at(schema: unknown, ...path: string[]): Record<string, unknown> {
	let node = schema as Record<string, unknown>;
	for (const key of path) node = node[key] as Record<string, unknown>;
	return node;
}

/**
 * Which dialect a provider speaks is the thing most likely to break a config swap, and it
 * is cheap to check offline: the real result schema is nested, so normalisation has to
 * reach the objects inside the array too.
 */
describe('toParameterSchema', () => {
	it('closes every object and lists every key in strict mode', () => {
		const schema = toParameterSchema(resultType, true);

		expect(schema.$schema).toBeUndefined();
		expect(schema.additionalProperties).toBe(false);
		expect(schema.required).toEqual(['error', 'resultParts', 'alternatives']);

		const part = at(schema, 'properties', 'resultParts', 'items');
		expect(part.additionalProperties).toBe(false);
		expect(part.required).toEqual(['text', 'type', 'explanation', 'references']);
	});

	it('drops additionalProperties entirely when the provider rejects it', () => {
		const schema = toParameterSchema(resultType, false);

		expect(schema.$schema).toBeUndefined();
		expect(schema.additionalProperties).toBeUndefined();
		expect(at(schema, 'properties', 'resultParts', 'items').additionalProperties).toBeUndefined();
	});

	it('keeps the enum and the descriptions the model needs', () => {
		const part = at(toParameterSchema(resultType, false), 'properties', 'resultParts', 'items');

		expect(at(part, 'properties', 'type').enum).toEqual([
			'original',
			'corrected',
			'added',
			'removed'
		]);
		expect(at(part, 'properties', 'explanation').description).toContain('Explanation');
	});
});

/** The SDK type is a union; every tool we build is the function kind. */
function asFunctionTool(tool: ChatCompletionTool) {
	if (tool.type !== 'function') throw new Error(`expected a function tool, got ${tool.type}`);
	return tool.function;
}

describe('toChatCompletionTool', () => {
	it('marks the tool strict only when the provider supports it', () => {
		const strict = asFunctionTool(toChatCompletionTool(kulonVagyEgybeFunction, true));
		const loose = asFunctionTool(toChatCompletionTool(kulonVagyEgybeFunction, false));

		expect(strict.strict).toBe(true);
		expect(loose.strict).toBeUndefined();
	});

	it('carries the name and description the model selects on', () => {
		const tool = asFunctionTool(toChatCompletionTool(kulonVagyEgybeFunction, false));

		expect(tool.name).toBe('kulon_vagy_egybe');
		expect(tool.description).toBe(kulonVagyEgybeFunction.description);
		expect(at(tool.parameters, 'properties', 'input').type).toBe('string');
	});
});
