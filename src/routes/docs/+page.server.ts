import getProvider from '$lib/llm/provider';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	try {
		const { id, model, reasoningEffort, maxTurns } = getProvider();
		return { llm: { provider: id, model, reasoningEffort: reasoningEffort ?? null, maxTurns } };
	} catch {
		return { llm: null };
	}
};
