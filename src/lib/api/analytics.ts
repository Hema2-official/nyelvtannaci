import { HTTPError } from 'ky';
import apiClient from './kyConfig';
import type { SubmissionEventInput, TelemetryEventInput } from '$lib/utils/analyticsEvents';

export function track(event: TelemetryEventInput) {
	apiClient
		.post('/api/analytics', { json: event, timeout: 5000, keepalive: true })
		.catch((error: unknown) => console.debug('Analytics event dropped:', error));
}

export async function submit(event: SubmissionEventInput) {
	try {
		const { id } = await apiClient
			.post('/api/analytics', { json: event, timeout: 30_000 })
			.json<{ id?: string }>();
		return id;
	} catch (error: unknown) {
		if (!(error instanceof HTTPError)) throw error;
		const responseText = await error.response.text();
		throw new Error(responseText || 'Submission failed');
	}
}
