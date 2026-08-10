import { z, type ZodType } from 'zod';
import { randomUUID, type UUID } from 'node:crypto';
import type {
	ChatCompletionMessageParam,
	ChatCompletionMessageToolCall,
	ChatCompletionTool,
	ReasoningEffort,
	ResponseFormatJSONSchema
} from 'openai/resources/index.mjs';
import type { LLMFunction } from './llmFunction.type';
import type { IntermediateSummary } from '$lib/UI/toolSummary.type';
import getProvider from './provider';
import { toChatCompletionTool, toParameterSchema } from './toolSchema';

const RESULT_TOOL_NAME = 'return_result';

/**
 * The model reasons in its own reasoning tokens, so assistant messages are only ever
 * tool calls or the final answer. How that answer comes back depends on the provider.
 */
const answeringInstructions = {
	structured: `

# Answering
Call tools until the check is complete, then answer with the final JSON result.
Every message either calls tools or is the final answer.`,
	tool: `

# Answering
Call tools until the check is complete, then call \`${RESULT_TOOL_NAME}\` exactly once with the final result.
Every message either calls tools or calls \`${RESULT_TOOL_NAME}\`; plain text replies are discarded.`
};

/** Some gateways wrap schema-constrained output in a markdown code fence anyway. */
function stripCodeFence(content: string) {
	const fenced = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(content);
	return fenced ? fenced[1] : content;
}

function describeError(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

class LLMSession<ResultType extends ZodType> {
	readonly id: UUID;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private functions: LLMFunction<any, any>[] = [];

	private messages: ChatCompletionMessageParam[] = [];

	private intermediateCallback: ((summary: IntermediateSummary[]) => unknown) | undefined;

	private resultType: ResultType;
	private result?: z.infer<ResultType>;

	constructor(instructions: string, resultType: ResultType) {
		this.id = randomUUID();
		this.resultType = resultType;

		const { systemRole, structuredOutputs } = getProvider();
		this.messages.push({
			role: systemRole,
			content: instructions + answeringInstructions[structuredOutputs ? 'structured' : 'tool']
		});
	}

	addMessage(message: ChatCompletionMessageParam) {
		this.messages.push(message);
		console.debug(message);
	}

	registerFunction(llmFunction: (typeof this.functions)[number]) {
		this.functions.push(llmFunction);
	}

	setIntermediateCallback(callback: (summary: IntermediateSummary[]) => unknown) {
		this.intermediateCallback = callback;
	}

	async getResult() {
		const { strictTools, structuredOutputs, maxTurns } = getProvider();

		// Providers that can't constrain output to a schema hand the result back through a tool.
		if (!structuredOutputs) this.registerFunction(this.resultFunction());

		// Assemble the tools in the dialect the provider understands
		const tools = this.functions.map((f) => toChatCompletionTool(f, strictTools));
		const responseFormat = structuredOutputs ? this.responseFormat() : undefined;

		// One turn is one model response: either a batch of tool calls or the final answer
		for (let turn = 0; turn < maxTurns && this.result === undefined; turn++) {
			const message = await this.complete(tools, responseFormat);
			this.addMessage(message);

			if (message.tool_calls?.length) {
				await this.runToolCalls(message.tool_calls);
			} else if (structuredOutputs) {
				this.acceptResult(message.content);
			} else {
				// The model wrote prose instead of handing back a result
				this.addMessage({
					role: 'user',
					content: `Continue with the tools, or call ${RESULT_TOOL_NAME} if the check is complete.`
				});
			}
		}

		if (this.result === undefined)
			throw new Error(`No result returned from the model within ${maxTurns} turns`);

		return this.result;
	}

	private async complete(
		tools: ChatCompletionTool[],
		responseFormat: ResponseFormatJSONSchema | undefined
	) {
		const { client, model, reasoningEffort } = getProvider();

		const completion = await client.chat.completions.create({
			messages: this.messages,
			model: model,
			tools: tools,
			stream: false,
			...(reasoningEffort ? { reasoning_effort: reasoningEffort as ReasoningEffort } : {}),
			...(responseFormat ? { response_format: responseFormat } : {})
		});

		// OpenAI-compatible gateways sometimes report failures in the body of a 200
		const error = (completion as { error?: { message?: string } }).error;
		if (error) throw new Error(error.message ?? 'The provider returned an error');

		const message = completion.choices?.[0]?.message;
		if (!message) throw new Error('The provider returned no completion choices');

		return message;
	}

	private async runToolCalls(toolCalls: ChatCompletionMessageToolCall[]) {
		for (const toolCall of toolCalls) {
			// Some gateways omit the (currently only) type discriminator
			if (toolCall.type && toolCall.type !== 'function')
				throw new Error('Unexpected tool call type');

			const llmFunction = this.functions.find((f) => f.name === toolCall.function.name);
			if (!llmFunction) throw new Error('Misconfigured tool: ' + toolCall.function.name);

			let output: string;
			try {
				// Parse zod arguments (can throw LLM-friendly error messages).
				// Parameterless calls may come back as an empty string instead of '{}'.
				const args = llmFunction.parameters.parse(JSON.parse(toolCall.function.arguments || '{}'));

				// Execute the tool (this should do so similarly)
				const results = await llmFunction.callback(args);
				output = JSON.stringify(results);

				// Provide an intermediate summary if applicable
				if (llmFunction.summarize && this.intermediateCallback) {
					try {
						this.intermediateCallback(llmFunction.summarize(args, results));
					} catch (error: unknown) {
						// Don't let this error get to the LLM
						console.error(error);
					}
				}
			} catch (error: unknown) {
				console.error(error);
				output = JSON.stringify({ error: describeError(error) });
			}

			// Tell the LLM about the result
			this.addMessage({ role: 'tool', content: output, tool_call_id: toolCall.id });
		}
	}

	/** A turn without tool calls is the final answer, constrained to the result schema. */
	private acceptResult(content: string | null) {
		try {
			this.result = this.resultType.parse(JSON.parse(stripCodeFence(content ?? '')));
		} catch (error: unknown) {
			console.error(error);
			this.addMessage({
				role: 'user',
				content: `That answer did not match the result schema (${describeError(error)}). Send it again in the required format.`
			});
		}
	}

	private responseFormat(): ResponseFormatJSONSchema {
		return {
			type: 'json_schema',
			json_schema: {
				name: 'result',
				strict: true,
				schema: toParameterSchema(this.resultType, true)
			}
		};
	}

	private resultFunction(): LLMFunction<ResultType, { accepted: true }> {
		return {
			name: RESULT_TOOL_NAME,
			description: 'Return the final result of the check. Call this exactly once, at the very end.',
			parameters: this.resultType,
			callback: async (args: z.infer<ResultType>) => {
				this.result = args;
				return { accepted: true };
			}
		};
	}
}

export default LLMSession;
