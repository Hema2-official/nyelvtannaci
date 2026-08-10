import type { Result } from '$lib/llm/promptConfig';
import { HTTPError } from 'ky';
import apiClient from './kyConfig';

export default async function testChecker(input: string) {
	try {
		// POST to the test API with the parameters
		return await apiClient.post('api/test-checker', { json: { input } }).json<Result>();
	} catch (error: unknown) {
		if (!(error instanceof HTTPError)) throw error;
		const responseText = await error.response.text();
		throw new Error(responseText || 'Checker test failed');
	}
}
