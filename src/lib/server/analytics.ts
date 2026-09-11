import { env } from '$env/dynamic/private';
import type { AnalyticsEvent } from '$lib/utils/analyticsEvents';

const submissionKinds = new Set<AnalyticsEvent['kind']>(['report', 'feedback']);

export async function record(event: AnalyticsEvent): Promise<string | undefined> {
	const baseUrl = env.SUPABASE_URL?.trim().replace(/\/+$/, '');
	const key = env.SUPABASE_SERVICE_KEY?.trim();
	if (!baseUrl || !key) return undefined;

	const { kind, ...rest } = event;
	const isSubmission = submissionKinds.has(kind);
	const table = isSubmission ? 'submissions' : 'telemetry';
	const row = isSubmission ? { kind, ...rest } : { kind, props: rest };

	const response = await fetch(`${baseUrl}/rest/v1/${table}`, {
		method: 'POST',
		headers: {
			apikey: key,
			Authorization: `Bearer ${key}`,
			'Content-Type': 'application/json',
			Prefer: isSubmission ? 'return=representation' : 'return=minimal'
		},
		body: JSON.stringify(row)
	});

	if (!response.ok) {
		throw new Error(`Supabase responded ${response.status}: ${await response.text()}`);
	}
	if (!isSubmission) return undefined;

	const [inserted] = (await response.json()) as { id?: string }[];
	return inserted?.id;
}
