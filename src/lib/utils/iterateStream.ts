/**
 * Replacement for ReadableStream[Symbol.asyncIterator] to improve compatibility with older Safari versions.
 */
export async function* iterateStream<T>(
	stream: ReadableStream<T>
): AsyncGenerator<T, void, undefined> {
	const reader = stream.getReader();
	let finished = false;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				finished = true;
				return;
			}
			yield value;
		}
	} finally {
		// An errored stream rejects its cancel() with the same error the read() already threw
		if (!finished) await reader.cancel().catch(() => undefined);
		reader.releaseLock();
	}
}
