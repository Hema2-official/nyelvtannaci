import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { record } from '$lib/server/analytics';
import { analyticsEvent } from '$lib/utils/analyticsEvents';
import { analyticsLimiter } from '$lib/server/rateLimit';
import { errorMessage } from '$lib/utils/errorMessage';

/** 128KB body limit, nothing needs more than that here */
const MAX_BODY = 128 * 1024;

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const limited = analyticsLimiter.reject(getClientAddress);
		if (limited) return limited;

		const body = await request.text();
		if (body.length > MAX_BODY) {
			return json({ error: 'Payload too large' }, { status: 413 });
		}

		let payload: unknown;
		try {
			payload = JSON.parse(body);
		} catch {
			return json({ error: 'Malformed JSON' }, { status: 400 });
		}

		const parsed = analyticsEvent.safeParse(payload);
		if (!parsed.success) {
			return json({ error: z.prettifyError(parsed.error) }, { status: 400 });
		}

		const id = await record(parsed.data);
		return id ? json({ id }, { status: 201 }) : new Response(null, { status: 204 });
	} catch (error: unknown) {
		// The caller is fire-and-forget, we log the error
		console.error('[analytics]', error);
		return json({ error: errorMessage(error, 'Analytics error') }, { status: 500 });
	}
};
