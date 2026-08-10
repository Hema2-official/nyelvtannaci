import type { Result } from '$lib/llm/promptConfig';
import { HTTPError } from 'ky';
import apiClient from './kyConfig';

export default async function check(input: string) {
	try {
		return await apiClient.post<Result>('api/check', { json: { input } });
	} catch (error: unknown) {
		if (!(error instanceof HTTPError)) throw error;
		const responseText = await error.response.text();
		throw new Error(responseText || 'Check failed');
	}
}
