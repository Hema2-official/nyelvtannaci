import runSession from '$lib/llm/runSession';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// get the request details (proxy json: input)
		const { input } = (await request.json()) as { input?: string };
		if (!input) throw new Error('No input specified');

		// run the session
		const result = await runSession(input);

		// return the result
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error: unknown) {
		// handle errors
		console.error(error);
		let message = 'Proxy error';
		if (error instanceof Error) message = error.message;
		return new Response(message, { status: 500 });
	}
};
