import LLMSession from './LLMSession';
import { availableFunctions, developerPrompt, resultType } from './promptConfig';

export default async function runSession(input: string) {
	const session = new LLMSession(developerPrompt, resultType.required());

	// Register all available functions
	availableFunctions.forEach((func) => session.registerFunction(func));

	// Add the user input
	session.addMessage({ role: 'user', content: input });

	// Subscribe to intermediate summaries
	session.setIntermediateCallback((summaries) => {
		console.log(summaries);
	});

	const result = await session.getResult();
	return result;
}
