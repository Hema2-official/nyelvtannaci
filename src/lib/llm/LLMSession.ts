import OpenAI from 'openai';
import { z, type ZodType } from 'zod';
import { zodFunction } from 'openai/helpers/zod';
import { randomUUID, type UUID } from 'node:crypto';
import { OPENAI_API_KEY, OPENAI_MODEL, SESSION_MESSAGE_LIMIT } from '$env/static/private';
import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import type { LLMFunction } from './promptConfig';
import type { IntermediateSummary } from '$lib/UI/toolSummary.type';

const messageLimit = Number.parseInt(SESSION_MESSAGE_LIMIT ?? '100');

const openai = new OpenAI({
	apiKey: OPENAI_API_KEY
});

class LLMSession<ResultType extends ZodType> {
	readonly id: UUID;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private functions: LLMFunction<any, any>[] = [];

	private messages: ChatCompletionMessageParam[] = [];

	private intermediateCallback: ((summary: IntermediateSummary[]) => unknown) | undefined;

	private resultType: ResultType;
	private result?: z.infer<ResultType>;

	constructor(developerPrompt: string, resultType: ResultType) {
		this.id = randomUUID();
		this.resultType = resultType;
		this.messages.push({
			role: 'developer',
			content: developerPrompt
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
		// Register the 'return_result' function
		this.registerFunction({
			name: 'return_result',
			description: 'Return the final result of the process',
			parameters: this.resultType,
			callback: (args: z.infer<ResultType>) => (this.result = args)
		});

		// Assemble the tools to be understood by OpenAI
		const tools = this.functions.map((f) =>
			zodFunction({
				name: f.name,
				parameters: f.parameters,
				description: f.description
			})
		);

		// Loop until the result is set by the LLM through 'return_result'
		while (!this.result && this.messages.length < messageLimit) {
			const completion = await openai.chat.completions.create({
				messages: this.messages,
				model: OPENAI_MODEL,
				tools: tools,
				n: 1,
				stream: false
			});

			this.addMessage(completion.choices[0].message);

			// Loop through tool calls and execute them
			for (const toolCall of completion.choices[0].message.tool_calls ?? []) {
				if (toolCall.type !== 'function') throw new Error('Unexpected tool call type');

				const llmFunction = this.functions.find((f) => f.name === toolCall.function.name);
				if (!llmFunction) throw new Error('Misconfigured tool: ' + toolCall.function.name);

				let output: string;
				try {
					// Parse zod arguments (can throw LLM-friendly error messages)
					const args = llmFunction.parameters.parse(JSON.parse(toolCall.function.arguments));

					// Execute the tool (this should do so similarly)
					const results = await llmFunction.callback(args);
					output = JSON.stringify(results);

					// Provide an intermediate summary if applicable
					if (llmFunction.summarize && this.intermediateCallback) {
						try {
							this.intermediateCallback(llmFunction.summarize(args, results));
						} catch (error) {
							// Don't let this error get to the LLM
							console.error(error);
						}
					}
				} catch (error) {
					console.error(error);
					output = JSON.stringify({
						error: error instanceof Error ? error.message : String(error)
					});
				}

				// Tell the LLM the results
				this.addMessage({
					role: 'tool',
					content: output,
					tool_call_id: toolCall.id
				});
			}
		}

		if (!this.result) throw new Error('No result returned from LLM');

		return this.result;
	}
}

export default LLMSession;
