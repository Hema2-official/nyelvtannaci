import type { Result } from '$lib/llm/promptConfig';
import { AxiosError, isAxiosError } from 'axios';
import axiosInstance from './axiosConfig';

export default async function testChecker(input: string) {
	try {
		// POST to the test API with the parameters
		return (await axiosInstance.post<Result>('/api/test-checker', { input })).data;
	} catch (error: unknown) {
		if (!isAxiosError(error)) throw error;
		const axiosError = error as AxiosError;
		throw new Error(
			typeof axiosError.response?.data === 'string'
				? axiosError.response?.data
				: 'Checker test failed'
		);
	}
}
