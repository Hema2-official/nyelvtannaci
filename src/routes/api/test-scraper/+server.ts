import scrapeMTA from '$lib/scraper/scrapeMTA';
import type { RequestHandler } from '@sveltejs/kit';
import type { ToolName } from '$lib/scraper/scraper.type';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// get the request details (proxy json: tool, input)
		const { tool, input } = (await request.json()) as { tool?: ToolName; input?: string };
		if (!tool || !input) throw 'No tool or input specified';

		// scrape MTA
		const result = await scrapeMTA(tool, input);

		// return the result
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		// handle errors
		console.error(error);
		let message = 'Proxy error';
		if (typeof error === 'string') message = error;
		else if (error instanceof Error) message = error.message;
		return new Response(message, { status: 500 });
	}
};
