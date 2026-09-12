import { errorMessage } from '$lib/utils/errorMessage';
import runSession from '$lib/llm/runSession';
import type { Result } from '$lib/llm/promptConfig';
import { checkConcurrency, checkLimiter } from '$lib/server/rateLimit';
import { record, type CheckEvent } from '$lib/server/analytics';
import { maxInputLength } from '$lib/utils/limits';
import type { RequestHandler } from '@sveltejs/kit';

function plainText(body: string, status: number, headers: Record<string, string> = {}) {
	return new Response(body, {
		status,
		headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers }
	});
}

/** Never the message itself - an invariant failure quotes the model's take on the input back. */
function failureReason(error: unknown, aborted: boolean): CheckEvent['reason'] {
	if (aborted) return 'aborted';
	const message = errorMessage(error, '');
	if (message.includes('turns')) return 'turns';
	if (message.includes('provider')) return 'provider';
	return 'other';
}

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

		const { input } = (await request.json()) as { input?: string };
		if (!input) throw new Error('No input specified');

		if (input.length > maxInputLength) {
			return plainText(
				`A szöveg túl hosszú: egyszerre legfeljebb ${maxInputLength} karakter ellenőrizhető.`,
				413
			);
		}

		const release = checkConcurrency.acquire();
		if (!release) {
			return plainText(
				'A szolgáltatás pillanatnyilag leterhelt. Próbáld újra pár másodperc múlva.',
				503,
				{ 'Retry-After': '30' }
			);
		}

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
					// if aborted, the reader is gone anyway
					if (!abort.signal.aborted) {
						console.error(error);
						sendEvent('error', errorMessage(error, 'Session error'));
					}

					recordCheck({
						kind: 'check',
						durationMs: Date.now() - startTime,
						inputLength: input.length,
						ok: false,
						reason: failureReason(error, abort.signal.aborted)
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
		return new Response(errorMessage(error, 'Proxy error'), { status: 500 });
	}
};
