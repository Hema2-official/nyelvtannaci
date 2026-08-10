import type { ZodType } from 'zod';
import type { ChatCompletionTool } from 'openai/resources/index.mjs';

type JsonSchema = Record<string, unknown>;

function isSchemaNode(value: unknown): value is JsonSchema {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * OpenAI tolerates (and in strict mode requires) `additionalProperties: false`,
 * while several models behind OpenRouter and OpenCode Zen reject it. Normalize
 * the schema for whichever dialect the provider speaks.
 */
function normalize(node: unknown, strict: boolean): void {
	if (Array.isArray(node)) {
		node.forEach((child) => normalize(child, strict));
		return;
	}
	if (!isSchemaNode(node)) return;

	delete node.$schema;

	const properties = node.properties;
	if (isSchemaNode(properties)) {
		if (strict) {
			// Strict mode has no notion of optional keys: every property must be listed.
			node.additionalProperties = false;
			node.required = Object.keys(properties);
		} else {
			delete node.additionalProperties;
		}
	}

	Object.values(node).forEach((child) => normalize(child, strict));
}

export function toParameterSchema(parameters: ZodType, strict: boolean): JsonSchema {
	const schema = parameters.toJSONSchema({ target: 'draft-07' }) as JsonSchema;
	normalize(schema, strict);
	return schema;
}

export function toChatCompletionTool(
	tool: { name: string; description: string; parameters: ZodType },
	strict: boolean
): ChatCompletionTool {
	return {
		type: 'function',
		function: {
			name: tool.name,
			description: tool.description,
			parameters: toParameterSchema(tool.parameters, strict),
			...(strict ? { strict: true } : {})
		}
	};
}
