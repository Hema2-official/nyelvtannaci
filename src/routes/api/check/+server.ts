import { errorMessage } from '$lib/utils/errorMessage';
import runSession from '$lib/llm/runSession';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { input } = (await request.json()) as { input?: string };
		if (!input) throw new Error('No input specified');

		// We abort when the client disconnects instead of finishing the inaccessible session
		const abort = new AbortController();

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
				} catch (error: unknown) {
					// if aborted, the reader is gone anyway
					if (!abort.signal.aborted) {
						console.error(error);
						sendEvent('error', errorMessage(error, 'Session error'));
					}
				} finally {
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
