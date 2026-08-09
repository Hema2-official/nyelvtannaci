import { z, type ZodType } from 'zod';
import { randomUUID, type UUID } from 'node:crypto';
import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import type { LLMFunction } from './promptConfig';
import type { IntermediateSummary } from '$lib/UI/toolSummary.type';
import getProvider from './provider';
import { toChatCompletionTool } from './toolSchema';

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
		this.messages.push({ role: getProvider().systemRole, content: developerPrompt });
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
		const { client, model, strictTools, messageLimit } = getProvider();

		// Register the 'return_result' function
		this.registerFunction({
			name: 'return_result',
			description: 'Return the final result of the process',
			parameters: this.resultType,
			callback: (args: z.infer<ResultType>) => (this.result = args)
		});

		// Assemble the tools in the dialect the provider understands
		const tools = this.functions.map((f) => toChatCompletionTool(f, strictTools));

		// Loop until the result is set by the LLM through 'return_result'
		while (!this.result && this.messages.length < messageLimit) {
			const completion = await client.chat.completions.create({
				messages: this.messages,
				model: model,
				tools: tools,
				stream: false
			});

			// OpenAI-compatible gateways sometimes report failures in the body of a 200
			const error = (completion as { error?: { message?: string } }).error;
			if (error) throw new Error(error.message ?? 'The provider returned an error');

			const message = completion.choices?.[0]?.message;
			if (!message) throw new Error('The provider returned no completion choices');

			this.addMessage(message);

			// Loop through tool calls and execute them
			for (const toolCall of message.tool_calls ?? []) {
				// Some gateways omit the (currently only) type discriminator
				if (toolCall.type && toolCall.type !== 'function')
					throw new Error('Unexpected tool call type');

				const llmFunction = this.functions.find((f) => f.name === toolCall.function.name);
				if (!llmFunction) throw new Error('Misconfigured tool: ' + toolCall.function.name);

				let output: string;
				try {
					// Parse zod arguments (can throw LLM-friendly error messages).
					// Parameterless calls may come back as an empty string instead of '{}'.
					const args = llmFunction.parameters.parse(
						JSON.parse(toolCall.function.arguments || '{}')
					);

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

		if (!this.result)
			throw new Error(`No result returned from LLM within ${messageLimit} messages`);

		return this.result;
	}
}

export default LLMSession;
