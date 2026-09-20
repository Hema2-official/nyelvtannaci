import { describe, expect, it } from 'vitest';
import { iterateStream } from '../../src/lib/utils/iterateStream';

function streamOf<T>(chunks: T[], onCancel?: (reason: unknown) => void) {
	return new ReadableStream<T>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk);
			controller.close();
		},
		cancel(reason) {
			onCancel?.(reason);
		}
	});
}

async function collect<T>(iterable: AsyncIterable<T>) {
	const items: T[] = [];
	for await (const item of iterable) items.push(item);
	return items;
}

describe('iterateStream', () => {
	it('yields every chunk in order and releases the stream when it ends', async () => {
		const stream = streamOf([1, 2, 3]);
		await expect(collect(iterateStream(stream))).resolves.toEqual([1, 2, 3]);
		expect(stream.locked).toBe(false);
	});

	it('cancels the source and releases the lock when the loop is left early', async () => {
		let cancelled = false;
		const stream = streamOf(['a', 'b', 'c'], () => (cancelled = true));

		const seen: string[] = [];
		for await (const chunk of iterateStream(stream)) {
			seen.push(chunk);
			break;
		}

		expect(seen).toEqual(['a']);
		expect(cancelled).toBe(true);
		expect(stream.locked).toBe(false);
	});

	it('propagates a stream error and releases the lock', async () => {
		const stream = new ReadableStream<number>({
			start(controller) {
				controller.enqueue(1);
				controller.error(new Error('boom'));
			}
		});

		await expect(collect(iterateStream(stream))).rejects.toThrow('boom');
		expect(stream.locked).toBe(false);
	});

	it('works without ReadableStream[Symbol.asyncIterator], as in Safari before 27', async () => {
		const proto = ReadableStream.prototype as unknown as Record<symbol, unknown>;
		const descriptor = Object.getOwnPropertyDescriptor(proto, Symbol.asyncIterator);
		expect(descriptor).toBeDefined();
		delete proto[Symbol.asyncIterator];

		try {
			// The loop the page used to run: this is the failure users saw on iOS
			await expect(collect(streamOf([1]) as unknown as AsyncIterable<number>)).rejects.toThrow(
				TypeError
			);

			await expect(collect(iterateStream(streamOf(['x', 'y'])))).resolves.toEqual(['x', 'y']);
		} finally {
			Object.defineProperty(proto, Symbol.asyncIterator, descriptor!);
		}
	});
});
