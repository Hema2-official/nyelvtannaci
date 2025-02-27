import type { ToolName } from '$lib/api/MTA.type';
import type { RequestHandler } from '@sveltejs/kit';
import FormData from 'form-data';
import axios, { type AxiosInstance } from 'axios';
import https from 'node:https';

const TOOL_META: Record<ToolName, { url: string; formFieldName: string }> = {
	kulonVagyEgybe: {
		url: 'https://helyesiras.mta.hu/helyesiras/default/kulegy',
		formFieldName: 'usrinp'
	},
	helyesEIgy: {
		url: 'https://helyesiras.mta.hu/helyesiras/default/suggest',
		formFieldName: 'word'
	},
	elvalasztas: {
		url: 'https://helyesiras.mta.hu/helyesiras/default/hyph',
		formFieldName: 'word'
	}
};

type SiteKeys = {
	formKey: string;
	formName: string;
};

const getSiteKeys = async (axiosInstance: AxiosInstance, tool: ToolName): Promise<SiteKeys> => {
	// fetch empty website to get site keys and cookies
	const emptySite = await axiosInstance.get<string>(TOOL_META[tool].url);

	if (!emptySite.headers['content-type'].toLowerCase().includes('text/html'))
		throw new Error('Content type was not text/html');

	// the keys are in the HTML as such:
	// <input name="_formkey" type="hidden" value="{_formKey}">
	// <input name="_formname" type="hidden" value="{_formName}">
	const formKey = emptySite.data.match(/name="_formkey" type="hidden" value="([^"]+)"/)?.[1];
	const formName = emptySite.data.match(/name="_formname" type="hidden" value="([^"]+)"/)?.[1];

	if (!formKey || !formName) throw new Error('Failed to get initial site keys');
	return { formKey, formName };
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		// get the request details (proxy json: tool, input)
		const proxyJson = await request.json();
		const tool = proxyJson.tool as ToolName | undefined;
		if (!tool || !TOOL_META[tool]) throw new Error('Invalid tool specified');
		const input = proxyJson.input as string | undefined;
		if (!input) throw new Error('No input specified');

		// create Axios instance and get site keys
		const axiosInstance = axios.create({
			withCredentials: true,
			httpsAgent: new https.Agent({ rejectUnauthorized: false })
		});
		const siteKeys = await getSiteKeys(axiosInstance, tool);
		console.debug('siteKeys', siteKeys);

		// construct form
		const form = new FormData();
		form.append(TOOL_META[tool].formFieldName, input);
		form.append('_formkey', siteKeys.formKey);
		form.append('_formname', siteKeys.formName);

		// POST to the tool's url
		const response = await axiosInstance.post<string>(TOOL_META[tool].url + '#', form, {
			headers: form.getHeaders()
		});

		if (!response.headers['content-type'].toLowerCase().includes('text/html'))
			throw new Error('Content type was not text/html');

		// return the HTML response
		return new Response(response.data, {
			status: response.status,
			headers: { 'Content-Type': 'text/html' }
		});
	} catch (error) {
		// handle errors
		console.error(error);
		const message = error instanceof Error ? error.message : 'Proxy error';
		return new Response(message, { status: 500 });
	}
};
