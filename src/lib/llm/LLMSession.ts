import { errorMessage } from '$lib/utils/errorMessage';
import { z, type ZodType } from 'zod';
import { randomUUID, type UUID } from 'node:crypto';
import { APIConnectionTimeoutError } from 'openai';
import type {
	ChatCompletion,
	ChatCompletionMessage,
	ChatCompletionMessageParam,
	ChatCompletionMessageToolCall,
	ChatCompletionTool,
	ReasoningEffort,
	ResponseFormatJSONSchema
} from 'openai/resources/index.mjs';
import type { LLMFunction } from './llmFunction.type';
import type { IntermediateSummary } from '$lib/llm/toolSummary.type';
import getProvider from './provider';
import { toChatCompletionTool, toParameterSchema } from './toolSchema';
import parseModelJson from './parseModelJson';

const RESULT_TOOL_NAME = 'return_result';

/**
 * An empty turn is asked again from the same history, and a history that keeps producing
 * nothing would spend every turn the session has, a capped loop at a time. This many in a
 * row ends the session.
 */
const EMPTY_TURNS_IN_A_ROW = 3;

/** One model response, as the session log keeps it. */
export type TurnRecord = {
	/** As the gateway reports it: `tool_calls`, `stop`, `length` (the completion cap), ... */
	finishReason: string | null;
	ms: number;
	completionTokens: number;
	reasoningTokens?: number;
	servedBy?: string;
	/** Left out of the history: it called no tool and said nothing, so only its reasoning is here. */
	dropped?: true;
	reasoning?: string;
};

/** What was asked of a tool and whether it answered, for whoever is keeping score. */
export type ToolCallRecord = {
	tool: string;
	/** As the model sent them, unparsed. */
	arguments: string;
	error?: string;
};

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

/** Name and arguments of a tool call, whichever kind the gateway says it is. */
function describeCall(toolCall: ChatCompletionMessageToolCall) {
	return 'function' in toolCall
		? { tool: toolCall.function.name, arguments: toolCall.function.arguments }
		: { tool: toolCall.custom.name, arguments: toolCall.custom.input };
}

/** The reasoning a response carried, once #complete has moved it to `reasoning`. */
function reasoningOf(message: ChatCompletionMessage) {
	const reasoning = (message as unknown as Record<string, unknown>).reasoning;
	return typeof reasoning === 'string' && reasoning ? reasoning : undefined;
}

class LLMSession<ResultType extends ZodType> {
	readonly id: UUID;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	#functions: LLMFunction<any, any>[] = [];

	#messages: ChatCompletionMessageParam[] = [];

	#intermediateCallback: ((summary: IntermediateSummary[]) => Promise<void>) | undefined;

	#resultType: ResultType;
	#result?: z.infer<ResultType>;

	#usage = {
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0,
		reasoningTokens: 0
	};

	#servedBy: string[] = [];

	/** Every model response, the ones left out of the history included. */
	#turns: TurnRecord[] = [];

	#toolCallObserver: ((call: ToolCallRecord) => void) | undefined;

	/** Mechanical checks on a well-formed result, applied before it is accepted. */
	#resultValidator: ((result: z.infer<ResultType>) => string | undefined) | undefined;

	/**
	 * A rejected result costs a turn, and a model that cannot satisfy the checks would spend
	 * every one of them. After this many rejections the answer is taken as it stands.
	 */
	#rejectionsLeft = 2;

	/**
	 * The model emits parts and never reads their concatenation, so the text the reader will
	 * actually see is the one thing it has not checked. This shows it once, at the end.
	 */
	#buildReview: ((result: z.infer<ResultType>) => string) | undefined;
	#reviewDone = false;
	/** The reviewed-from answer, kept so a session that runs out of turns still returns one. */
	#pendingResult?: z.infer<ResultType>;

	/** Set when the caller is gone; the session stops at the next opportunity. */
	#signal?: AbortSignal;

	constructor(instructions: string, resultType: ResultType, signal?: AbortSignal) {
		this.id = randomUUID();
		this.#resultType = resultType;
		this.#signal = signal;

		const { systemRole, structuredOutputs } = getProvider();
		this.#messages.push({
			role: systemRole,
			content: instructions + answeringInstructions[structuredOutputs ? 'structured' : 'tool']
		});
	}

	addMessage(message: ChatCompletionMessageParam) {
		this.#messages.push(message);
	}

	get messages(): readonly ChatCompletionMessageParam[] {
		return this.#messages;
	}

	get usage() {
		return { ...this.#usage };
	}

	/** The distinct upstreams that answered this session, in the order they first did. */
	get servedBy(): string[] {
		return [...new Set(this.#servedBy)];
	}

	get turns(): readonly TurnRecord[] {
		return this.#turns;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	registerFunction(llmFunction: LLMFunction<any, any>) {
		this.#functions.push(llmFunction);
	}

	setIntermediateCallback(callback: (summary: IntermediateSummary[]) => Promise<void>) {
		this.#intermediateCallback = callback;
	}

	/** Hears about every tool call, the failed ones too, which the summaries leave out. */
	setToolCallObserver(observer: (call: ToolCallRecord) => void) {
		this.#toolCallObserver = observer;
	}

	setResultValidator(validator: (result: z.infer<ResultType>) => string | undefined) {
		this.#resultValidator = validator;
	}

	setReviewBuilder(build: (result: z.infer<ResultType>) => string) {
		this.#buildReview = build;
	}

	/**
	 * Accepts the result, or says what has to happen first. A rejection and a review are
	 * different events and are reported as different statuses: told only that its answer was
	 * "not accepted", the model reads a review as a refusal and goes hunting for a fault that
	 * is not there - observed turning "tej" into "telyj".
	 */
	#tryAcceptResult(
		candidate: z.infer<ResultType>
	): { status: 'rejected'; problem: string } | { status: 'confirm'; review: string } | undefined {
		const problem = this.#resultValidator?.(candidate);
		if (problem && this.#rejectionsLeft > 0) {
			this.#rejectionsLeft--;
			return { status: 'rejected', problem };
		}

		if (this.#buildReview && !this.#reviewDone) {
			this.#reviewDone = true;
			this.#pendingResult = candidate;
			return { status: 'confirm', review: this.#buildReview(candidate) };
		}

		this.#result = candidate;
		return undefined;
	}

	async getResult() {
		const { strictTools, structuredOutputs, maxTurns } = getProvider();

		// Providers that can't constrain output to a schema hand the result back through a tool.
		if (!structuredOutputs) this.registerFunction(this.#resultFunction());

		// Assemble the tools in the dialect the provider understands
		const tools = this.#functions.map((f) => toChatCompletionTool(f, strictTools));
		const responseFormat = structuredOutputs ? this.#responseFormat() : undefined;

		// One turn is one model response: either a batch of tool calls or the final answer
		let emptyTurns = 0;
		for (let turn = 0; turn < maxTurns && this.#result === undefined; turn++) {
			this.#signal?.throwIfAborted();
			// the review turn is for reading, not for re-querying: only the result tool is offered
			const turnTools = this.#reviewDone
				? tools.filter(
						(tool) => tool.type === 'function' && tool.function.name === RESULT_TOOL_NAME
					)
				: tools;
			const { message, record } = await this.#complete(turnTools, responseFormat);

			if (!message.tool_calls?.length && !message.content?.trim()) {
				record.dropped = true;
				record.reasoning = reasoningOf(message);
				if (++emptyTurns === EMPTY_TURNS_IN_A_ROW) break;
				this.#askToContinue(structuredOutputs);
				continue;
			}

			emptyTurns = 0;
			this.addMessage(message);

			if (message.tool_calls?.length) {
				await this.#runToolCalls(message.tool_calls);
			} else if (structuredOutputs) {
				this.#acceptResult(message.content);
			} else {
				// The model wrote prose instead of handing back a result
				this.#askToContinue(structuredOutputs);
			}
		}

		// a session that reviewed but never re-submitted still has an answer worth returning
		if (this.#result === undefined) this.#result = this.#pendingResult;

		if (this.#result === undefined)
			throw new Error(
				emptyTurns === EMPTY_TURNS_IN_A_ROW
					? `No result returned from the model: ${emptyTurns} turns in a row came back empty`
					: `No result returned from the model within ${maxTurns} turns`
			);

		return this.#result;
	}

	/** Asks for the next step after a turn that neither called a tool nor answered. */
	#askToContinue(structuredOutputs: boolean) {
		const content = structuredOutputs
			? 'Continue with the tools, or answer with the final JSON result if the check is complete.'
			: `Continue with the tools, or call ${RESULT_TOOL_NAME} if the check is complete.`;

		// after a dropped turn the history can already end with this very question
		const last = this.#messages.at(-1);
		if (last?.role === 'user' && last.content === content) return;

		this.addMessage({ role: 'user', content });
	}

	async #complete(
		tools: ChatCompletionTool[],
		responseFormat: ResponseFormatJSONSchema | undefined
	) {
		const { client, model, reasoningEffort, extraBody, temperature, completionCap, timeoutMs } =
			getProvider();

		const deadline = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
		const signals = [this.#signal, deadline].filter((signal) => signal !== undefined);
		const started = Date.now();

		let completion: ChatCompletion;
		try {
			completion = await client.chat.completions.create(
				{
					messages: this.#messages,
					model: model,
					tools: tools,
					stream: false,
					...(typeof temperature === 'number' ? { temperature } : {}),
					...(reasoningEffort ? { reasoning_effort: reasoningEffort as ReasoningEffort } : {}),
					...(responseFormat ? { response_format: responseFormat } : {}),
					...completionCap,
					...extraBody
				},
				// the caller going away ends the request just as the deadline does
				{ signal: signals.length ? AbortSignal.any(signals) : undefined }
			);
		} catch (error: unknown) {
			if (timeoutMs && deadline?.aborted && !this.#signal?.aborted)
				throw new APIConnectionTimeoutError({
					message: `The model did not answer within ${timeoutMs / 1000} s`
				});
			throw error;
		}

		// OpenAI-compatible gateways sometimes report failures in the body of a 200
		const error = (completion as { error?: { message?: string } }).error;
		if (error) throw new Error(error.message ?? 'The provider returned an error');

		const servedBy = (completion as { provider?: unknown }).provider;
		if (typeof servedBy === 'string' && servedBy) this.#servedBy.push(servedBy);

		const reasoningTokens = completion.usage?.completion_tokens_details?.reasoning_tokens;
		if (completion.usage) {
			this.#usage.promptTokens += completion.usage.prompt_tokens ?? 0;
			this.#usage.completionTokens += completion.usage.completion_tokens ?? 0;
			this.#usage.totalTokens += completion.usage.total_tokens ?? 0;
			if (typeof reasoningTokens === 'number') {
				this.#usage.reasoningTokens += reasoningTokens;
			}
		}

		const choice = completion.choices?.[0];
		const message = choice?.message;
		if (!message) throw new Error('The provider returned no completion choices');

		const record: TurnRecord = {
			finishReason: choice.finish_reason ?? null,
			ms: Date.now() - started,
			completionTokens: completion.usage?.completion_tokens ?? 0,
			...(typeof reasoningTokens === 'number' ? { reasoningTokens } : {}),
			...(typeof servedBy === 'string' && servedBy ? { servedBy } : {})
		};
		this.#turns.push(record);

		// gateways name the reasoning differently, and some hang it on the choice instead
		const fields = message as unknown as Record<string, unknown>;
		const choiceFields = choice as unknown as Record<string, unknown>;
		const rawReasoning =
			fields.reasoning ??
			fields.reasoning_content ??
			choiceFields.reasoning ??
			choiceFields.reasoning_content;

		if (rawReasoning !== undefined && fields.reasoning === undefined) {
			fields.reasoning = rawReasoning;
		}

		return { message, record };
	}

	async #runToolCall(toolCall: ChatCompletionMessageToolCall) {
		let output: string;
		let failure: string | undefined;
		try {
			// Some gateways omit the (currently only) type discriminator
			if (toolCall.type && toolCall.type !== 'function')
				throw new Error(`Unsupported tool call type "${toolCall.type}"`);

			const llmFunction = this.#functions.find((f) => f.name === toolCall.function.name);
			if (!llmFunction)
				throw new Error(
					`Unknown tool "${toolCall.function.name}". The available tools are: ` +
						this.#functions.map((f) => f.name).join(', ')
				);

			// Parse zod arguments (can throw LLM-friendly error messages).
			// Parameterless calls may come back as an empty string instead of '{}'.
			const args = parseModelJson(llmFunction.parameters, toolCall.function.arguments || '{}');

			// Execute the tool (this should do so similarly)
			const results = await llmFunction.callback(args);
			output = JSON.stringify(results);

			// Provide an intermediate summary if applicable
			if (llmFunction.summarize && this.#intermediateCallback) {
				try {
					await this.#intermediateCallback(llmFunction.summarize(args, results));
				} catch (error: unknown) {
					// Don't let this error get to the LLM
					console.error(error);
				}
			}
		} catch (error: unknown) {
			console.error(error);
			failure = errorMessage(error);
			output = JSON.stringify({ error: failure });
		}

		try {
			this.#toolCallObserver?.({
				...describeCall(toolCall),
				...(failure !== undefined ? { error: failure } : {})
			});
		} catch (error: unknown) {
			// the score is kept for us, and keeping it must not cost the session
			console.error(error);
		}

		// Tell the LLM about the result
		this.addMessage({ role: 'tool', content: output, tool_call_id: toolCall.id });
	}

	async #runToolCalls(toolCalls: ChatCompletionMessageToolCall[]) {
		await Promise.all(toolCalls.map((toolCall) => this.#runToolCall(toolCall)));
	}

	/** A turn without tool calls is the final answer, constrained to the result schema. */
	#acceptResult(content: string | null) {
		try {
			const candidate = parseModelJson(this.#resultType, stripCodeFence(content ?? ''));
			const outcome = this.#tryAcceptResult(candidate);
			if (outcome)
				this.addMessage({
					role: 'user',
					content:
						outcome.status === 'rejected'
							? `${outcome.problem} Send the result again.`
							: outcome.review
				});
		} catch (error: unknown) {
			console.error(error);
			this.addMessage({
				role: 'user',
				content: `That answer did not match the result schema (${errorMessage(error)}). Send it again in the required format.`
			});
		}
	}

	#responseFormat(): ResponseFormatJSONSchema {
		return {
			type: 'json_schema',
			json_schema: {
				name: 'result',
				strict: true,
				schema: toParameterSchema(this.#resultType, true)
			}
		};
	}

	#resultFunction(): LLMFunction<
		ResultType,
		| { status: 'accepted' }
		| { status: 'rejected'; problem: string }
		| { status: 'confirm'; review: string }
	> {
		return {
			name: RESULT_TOOL_NAME,
			description: 'Return the final result of the check. Call this exactly once, at the very end.',
			parameters: this.#resultType,
			callback: async (args: z.infer<ResultType>) => {
				// what comes back goes through this tool's own output, which is where the model is looking
				return this.#tryAcceptResult(args) ?? { status: 'accepted' as const };
			}
		};
	}
}

export default LLMSession;
