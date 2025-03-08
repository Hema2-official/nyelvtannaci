import type { ToolName, ToolResult } from '$lib/scraper/scraper.type';
import { AxiosError, isAxiosError } from 'axios';
import axiosInstance from './axiosConfig';

export default async function testScraper(tool: ToolName, input: string) {
	try {
		// POST to the test API with the parameters
		return (await axiosInstance.post<ToolResult>('/api/test-scraper', { tool, input })).data;
	} catch (error) {
		if (!isAxiosError(error)) throw error;
		const axiosError = error as AxiosError;
		throw new Error(
			typeof axiosError.response?.data === 'string'
				? axiosError.response?.data
				: 'Failed to scrape MTA'
		);
	}
}
