/** Install a compatibility fill-in for Safari <17.4 */
export function installAbortSignalAny(): void {
	if (typeof AbortSignal === 'undefined' || typeof AbortSignal.any === 'function') return;

	AbortSignal.any = (signals: AbortSignal[]): AbortSignal => {
		const controller = new AbortController();
		for (const signal of signals) {
			if (signal.aborted) {
				controller.abort(signal.reason);
				break;
			}
			signal.addEventListener('abort', () => controller.abort(signal.reason), {
				once: true,
				signal: controller.signal
			});
		}
		return controller.signal;
	};
}
