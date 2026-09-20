import { afterEach, describe, expect, it } from 'vitest';
import { installAbortSignalAny } from '../../src/lib/utils/abortSignalAny';

const native = AbortSignal.any;

/** Simulates Safari before 17.4, where the static does not exist. */
function removeNative() {
	delete (AbortSignal as { any?: unknown }).any;
	expect(typeof AbortSignal.any).toBe('undefined');
}

describe('installAbortSignalAny', () => {
	afterEach(() => {
		AbortSignal.any = native;
	});

	it('leaves a native implementation alone', () => {
		installAbortSignalAny();
		expect(AbortSignal.any).toBe(native);
	});

	it('installs an equivalent that follows whichever input aborts first', () => {
		removeNative();
		installAbortSignalAny();
		expect(typeof AbortSignal.any).toBe('function');

		const a = new AbortController();
		const b = new AbortController();
		const combined = AbortSignal.any([a.signal, b.signal]);
		expect(combined.aborted).toBe(false);

		b.abort('stop');
		expect(combined.aborted).toBe(true);
		expect(combined.reason).toBe('stop');
	});

	it('starts aborted when one of the inputs already is', () => {
		removeNative();
		installAbortSignalAny();

		const early = new AbortController();
		early.abort('early');
		const combined = AbortSignal.any([new AbortController().signal, early.signal]);
		expect(combined.aborted).toBe(true);
		expect(combined.reason).toBe('early');
	});
});
