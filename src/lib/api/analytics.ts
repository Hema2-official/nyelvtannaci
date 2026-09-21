import { HTTPError } from 'ky';
import apiClient from './kyConfig';
import type { SubmissionEventInput, TelemetryEventInput } from '$lib/utils/analyticsEvents';

const ANALYTICS_URL = '/api/analytics';

export function track(event: TelemetryEventInput) {
	const body = JSON.stringify(event);

	try {
		// Try sendBeacon first to ensure events are sent after the tab closes
		const blob = new Blob([body], { type: 'application/json' });
		if (navigator.sendBeacon?.(ANALYTICS_URL, blob)) return;
	} catch (error: unknown) {
		console.debug('Analytics beacon failed, falling back:', error);
	}

	apiClient
		.post(ANALYTICS_URL, { json: event, timeout: 5000, keepalive: true })
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
