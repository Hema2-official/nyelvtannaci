import { errorMessage } from '$lib/utils/errorMessage';
import runSession from '$lib/llm/runSession';
import type { Result } from '$lib/llm/promptConfig';
import { checkConcurrency, checkLimiter } from '$lib/server/rateLimit';
import { record, type CheckEvent } from '$lib/server/analytics';
import { maxInputLength } from '$lib/utils/limits';
import type { RequestHandler } from '@sveltejs/kit';
import { APIError } from 'openai';
import { z } from 'zod';

const checkRequest = z.object({ input: z.string() });

function plainText(body: string, status: number, headers: Record<string, string> = {}) {
	return new Response(body, {
		status,
		headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers }
	});
}

// Hungarian error messages
const badRequest = () => plainText('Érvénytelen kérelem.', 400);
const noInput = () => plainText('Nincs ellenőrizendő szöveg.', 400);
const tooLong = () =>
	plainText(`Egyszerre legfeljebb ${maxInputLength} karakter ellenőrizhető.`, 413);
const overloaded = () =>
	plainText('A szolgáltatás pillanatnyilag leterhelt. Próbáld újra pár másodperc múlva.', 503, {
		'Retry-After': '30'
	});

/** adapter-node errors the body stream at `BODY_SIZE_LIMIT`, and that is a 413, not bad JSON. */
function isPayloadTooLarge(error: unknown) {
	return (
		typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 413
	);
}

async function readInput(request: Request): Promise<string | Response> {
	let body: unknown;
	try {
		body = await request.json();
	} catch (error: unknown) {
		return isPayloadTooLarge(error) ? tooLong() : badRequest();
	}

	const parsed = checkRequest.safeParse(body);
	if (!parsed.success) return noInput();

	const input = parsed.data.input.trim();
	if (!input) return noInput();
	if (input.length > maxInputLength) return tooLong();

	return input;
}

type FailureReason = NonNullable<CheckEvent['reason']>;

/** Categorizes failures into safe reasons to avoid exposing raw error details to the user. */
function failureReason(error: unknown, aborted: boolean): FailureReason {
	if (aborted) return 'aborted';
	const message = errorMessage(error, '');
	if (message.includes('turns')) return 'turns';
	if (error instanceof APIError || message.includes('provider')) return 'provider';
	return 'other';
}

/** What the reader sees. The detail went to the server log, which is where it is of any use. */
const failureMessages: Record<FailureReason, string> = {
	aborted: 'Az ellenőrzés megszakadt.',
	turns: 'Az ellenőrzés nem fejeződött be a megengedett kereteken belül. Próbáld újra.',
	provider: 'A nyelvi modell szolgáltatója nem válaszolt. Próbáld újra később.',
	other: 'Az ellenőrzés hiba miatt megszakadt. Próbáld újra.'
};

function countParts(result: Result) {
	const parts: CheckEvent['parts'] = {};
	for (const { type } of result.resultParts) parts[type] = (parts[type] ?? 0) + 1;
	return parts;
}

/** Fire and forget: a correction that worked must not fail over its own bookkeeping. */
function recordCheck(event: CheckEvent) {
	record(event).catch((error: unknown) => console.error('[analytics]', error));
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const limited = checkLimiter.reject(getClientAddress);
		if (limited) return limited;

		const input = await readInput(request);
		if (input instanceof Response) return input;

		const release = checkConcurrency.acquire();
		if (!release) return overloaded();

		// We abort when the client disconnects instead of finishing the inaccessible session
		const abort = new AbortController();
		const startTime = Date.now();

		const stream = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();
				const sendEvent = (event: string, data: unknown) => {
					if (abort.signal.aborted) return;
					try {
						controller.enqueue(
							encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
						);
					} catch (e) {
						console.warn('Failed to enqueue data to stream:', e);
					}
				};

				try {
					const result = await runSession(
						input,
						async (summary) => sendEvent('intermediate', summary),
						async () => sendEvent('init', 'hi'),
						abort.signal
					);
					sendEvent('result', result);

					recordCheck({
						kind: 'check',
						durationMs: Date.now() - startTime,
						inputLength: input.length,
						ok: !result.error,
						parts: countParts(result)
					});
				} catch (error: unknown) {
					const reason = failureReason(error, abort.signal.aborted);

					// if aborted, the reader is gone anyway
					if (reason !== 'aborted') {
						console.error(error);
						sendEvent('error', failureMessages[reason]);
					}

					recordCheck({
						kind: 'check',
						durationMs: Date.now() - startTime,
						inputLength: input.length,
						ok: false,
						reason
					});
				} finally {
					release();
					try {
						controller.close();
					} catch {
						// Stream might already be closed
					}
				}
			},
			cancel(reason) {
				console.debug('Client disconnected, aborting the session');
				abort.abort(reason);
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache'
			}
		});
	} catch (error: unknown) {
		console.error(error);
		return plainText('Váratlan hiba történt. Próbáld újra.', 500);
	}
};
