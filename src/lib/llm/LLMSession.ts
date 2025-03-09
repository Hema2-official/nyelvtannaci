import OpenAI from 'openai';
import { z, type ZodType } from 'zod';
import { zodFunction } from 'openai/helpers/zod';
import { isAutoParsableTool } from 'openai/lib/parser.mjs';
import { OPENAI_API_KEY, OPENAI_MODEL, SESSION_MESSAGE_LIMIT } from '$env/static/private';
import { randomUUID, type UUID } from 'node:crypto';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/index.mjs';

const messageLimit = Number.parseInt(SESSION_MESSAGE_LIMIT ?? '100');

const openai = new OpenAI({
	apiKey: OPENAI_API_KEY
});

class LLMSession<ResultType extends ZodType> {
	readonly id: UUID;

	private tools: ChatCompletionTool[] = [];
	private messages: ChatCompletionMessageParam[] = [];

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

	registerFunction<Parameters extends ZodType>(
		name: string,
		description: string,
		parameters: Parameters,
		callback: (args: z.infer<Parameters>) => Promise<unknown>
	) {
		this.tools.push(zodFunction({ name, parameters, function: callback, description }));
	}

	async getResult() {
		// Register the 'return_result' tool
		this.registerFunction(
			'return_result',
			'Return the final result of the process',
			this.resultType,
			(args: z.infer<ResultType>) => (this.result = args)
		);

		// Loop until the result is set by the LLM through 'return_result'
		while (!this.result && this.messages.length < messageLimit) {
			const completion = await openai.chat.completions.create({
				messages: this.messages,
				model: OPENAI_MODEL,
				tools: this.tools,
				n: 1,
				stream: false
			});

			this.addMessage(completion.choices[0].message);

			// Loop through tool calls and execute them
			for (const toolCall of completion.choices[0].message.tool_calls ?? []) {
				if (toolCall.type !== 'function') throw new Error('Unexpected tool call type');
				const tool = this.tools.find((t) => t.function.name === toolCall.function.name);
				if (!tool || !isAutoParsableTool(tool) || !tool.$callback)
					throw new Error('Misconfigured tool: ' + toolCall.function.name);

				let output: string;
				try {
					// Parse zod arguments (can throw LLM-friendly error messages)
					const args = tool.$parseRaw(toolCall.function.arguments);

					// Execute the tool (this should do so similarly)
					output = JSON.stringify(await tool.$callback(args));
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
