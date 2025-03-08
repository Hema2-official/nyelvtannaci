import { tools, type ToolName, type ToolResult } from './scraper.type';
import axios, { AxiosError, isAxiosError } from 'axios';
import https from 'node:https';
import { MTA_BASE_URL } from '$env/static/private';
import { parse } from 'node-html-parser';

const axiosInstance = axios.create({
	withCredentials: false,
	httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

export default async function scrapeMTA(toolName: ToolName, input: string): Promise<ToolResult> {
	try {
		// validate input
		if (!(toolName in tools)) throw `Unknown tool: ${toolName}`;
		if (!input) throw 'Input is required';
		const tool = tools[toolName];

		// check input for invalid or malicious data
		if (!input || /[<>'"/\\]/.test(input)) throw 'Invalid input';

		// GET the tool's url with the input
		const response = await axiosInstance.get<string>(MTA_BASE_URL + tool.url, {
			params: { q: input.trim() }
		});

		if (!response.headers['content-type'].toLowerCase().includes('text/html'))
			throw 'Content type was not text/html';

		// parse the HTML response
		const doc = parse(response.data);

		// parse by tool
		return tool.parse(doc);
	} catch (error) {
		if (!isAxiosError(error)) throw typeof error === 'string' ? new Error(error) : error;
		const axiosError = error as AxiosError;
		throw new Error(
			typeof axiosError.response?.data === 'string'
				? axiosError.response?.data
				: 'Failed to scrape MTA'
		);
	}
}
