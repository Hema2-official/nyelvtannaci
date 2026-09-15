import { HTTPError, type Options } from 'ky';
import apiClient from './kyConfig';

export default async function check(input: string, options?: Options) {
	try {
		return await apiClient.post<void>('/api/check', { ...options, json: { input } });
	} catch (error: unknown) {
		if (!(error instanceof HTTPError)) throw error;
		const responseText = await error.response.text();
		throw new Error(responseText || 'Check failed');
	}
}
