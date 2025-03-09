import LLMSession from './LLMSession';
import { availableFunctions, developerPrompt, resultType } from './promptConfig';

export default async function runSession(input: string) {
	const session = new LLMSession(developerPrompt, resultType.required());

	for (const func of availableFunctions) {
		session.registerFunction(
			func.name,
			func.description,
			func.parameters.required(),
			func.callback
		);
	}

	session.addMessage({ role: 'user', content: input });

	const result = await session.getResult();

	return result;
}
