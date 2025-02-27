import type { ToolName } from '$lib/api/MTA.type';
import type { RequestHandler } from '@sveltejs/kit';
import axios from 'axios';
import https from 'node:https';

const TOOL_URLS: Record<ToolName, string> = {
	kulonVagyEgybe: 'https://helyesiras.mta.hu/helyesiras/default/kulegy',
	helyesEIgy: 'https://helyesiras.mta.hu/helyesiras/default/suggest',
	elvalasztas: 'https://helyesiras.mta.hu/helyesiras/default/hyph'
};

const axiosInstance = axios.create({
	withCredentials: false,
	httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		// get the request details (proxy json: tool, input)
		const proxyJson = await request.json();
		const tool = proxyJson.tool as ToolName | undefined;
		if (!tool || !TOOL_URLS[tool]) throw 'Invalid tool specified';
		if (!proxyJson.input || typeof proxyJson.input !== 'string') throw 'Invalid input';
		const input = (proxyJson.input as string).trim();

		// check input for invalid or malicious data
		if (!input || /[<>'"/\\]/.test(input)) throw 'Invalid input';

		// GET the tool's url with the input
		const response = await axiosInstance.get<string>(TOOL_URLS[tool], {
			params: { q: input }
		});

		if (!response.headers['content-type'].toLowerCase().includes('text/html'))
			throw 'Content type was not text/html';

		// return the HTML response
		return new Response(response.data, {
			status: response.status,
			headers: { 'Content-Type': 'text/html' }
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
