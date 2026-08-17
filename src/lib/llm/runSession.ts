import type { IntermediateSummary } from '$lib/llm/toolSummary.type';
import LLMSession from './LLMSession';
import { availableFunctions, developerPrompt, resultType, type Result } from './promptConfig';
import checkResultInvariants from '../logic/resultInvariants';
import buildReview from './buildReview';
import splitSentences from '../logic/splitSentences';
import mergeChunkResults, { originalPart } from '../logic/mergeChunkResults';

type IntermediateCallback = (summary: IntermediateSummary[]) => Promise<void>;

const defaultCallback: IntermediateCallback = async (sum) => console.log(sum);

/** One text, one session, one result. */
export async function runSingleSession(
	input: string,
	intermediateCallback: IntermediateCallback = defaultCallback
): Promise<Result> {
	const session = new LLMSession(developerPrompt, resultType.required());

	// Register all available functions
	availableFunctions.forEach((llmFunction) => session.registerFunction(llmFunction));

	// Add the user input
	session.addMessage({ role: 'user', content: input });

	// Subscribe to intermediate summaries
	session.setIntermediateCallback(intermediateCallback);

	// Reject a malformed result before it reaches the reader, and say what is wrong with it
	session.setResultValidator((result) => checkResultInvariants(input, result));

	if (process.env.SESSION_REVIEW === 'on')
		session.setReviewBuilder((result) => buildReview(input, result));

	return (await session.getResult()) as Result;
}

/** Runs `tasks` with at most `limit` in flight, keeping the results in order. */
async function mapWithLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>) {
	const results = new Array<R>(items.length);
	let next = 0;

	const worker = async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await run(items[index]);
		}
	};

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

/** A sentence at a time, concurrently. */
export async function runChunkedSession(
	input: string,
	intermediateCallback: IntermediateCallback = defaultCallback,
	concurrency = 3
): Promise<Result> {
	const chunks = splitSentences(input);
	if (chunks.length <= 1) return runSingleSession(input, intermediateCallback);

	const results = await mapWithLimit(chunks, concurrency, async (chunk) => {
		try {
			return await runSingleSession(chunk.text, intermediateCallback);
		} catch (error: unknown) {
			// one sentence failing is not a reason to lose the rest of the text
			return {
				error: error instanceof Error ? error.message : String(error),
				resultParts: [originalPart(chunk.text)],
				alternatives: []
			} satisfies Result;
		}
	});

	return mergeChunkResults(chunks, results);
}

export default async function runSession(
	input: string,
	intermediateCallback: IntermediateCallback = defaultCallback
): Promise<Result> {
	return process.env.PARALLEL_SENTENCES === 'on'
		? runChunkedSession(input, intermediateCallback)
		: runSingleSession(input, intermediateCallback);
}
