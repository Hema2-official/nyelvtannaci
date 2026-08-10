import type { IntermediateSummary } from '$lib/UI/toolSummary.type';
import LLMSession from './LLMSession';
import { availableFunctions, developerPrompt, resultType } from './promptConfig';

export default async function runSession(
	input: string,
	intermediateCallback: (summary: IntermediateSummary[]) => Promise<void> = async (sum) =>
		console.log(sum)
) {
	const session = new LLMSession(developerPrompt, resultType.required());

	// Register all available functions
	availableFunctions.forEach((llmFunction) => session.registerFunction(llmFunction));

	// Add the user input
	session.addMessage({ role: 'user', content: input });

	// Subscribe to intermediate summaries
	session.setIntermediateCallback(intermediateCallback);

	const result = await session.getResult();
	return result;
}
