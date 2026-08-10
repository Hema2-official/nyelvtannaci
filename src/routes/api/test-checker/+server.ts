import { errorMessage } from '$lib/utils/errorMessage';
import runSession from '$lib/llm/runSession';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { input } = (await request.json()) as { input?: string };
		if (!input) throw new Error('No input specified');

		const result = await runSession(input);

		return new Response(JSON.stringify(result), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error: unknown) {
		console.error(error);
		return new Response(errorMessage(error, 'Proxy error'), { status: 500 });
	}
};
