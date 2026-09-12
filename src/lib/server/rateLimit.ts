import { env } from '$env/dynamic/private';
import { errorMessage } from '$lib/utils/errorMessage';

const DEFAULT_WINDOW_SECONDS = 60;
const MAX_TRACKED = 10_000;

type Settings = { enabled: boolean; requests: number; windowMs: number };

type LimiterOptions = {
	/** Requests per window, unless `RATE_LIMIT_<NAME>` says otherwise. */
	limit: number;
	/** The body of the 429. `/api/check` shows its errors to the reader, so this is Hungarian. */
	message: string;
};

/** One unreadable address is one deployment fault, not one per request. */
let warnedAboutAddress = false;

function positiveNumber(name: string, fallback: number) {
	const raw = env[name]?.trim();
	if (!raw) return fallback;

	const value = Number(raw);
	if (Number.isFinite(value) && value > 0) return value;

	console.warn(`[rateLimit] ${name}=${raw} is not a positive number, using ${fallback}`);
	return fallback;
}

/**
 * A sliding window of request timestamps per caller, in this process's memory: it forgets
 * everything on restart and knows nothing of any other instance. Addresses are keys in the map
 * and are never written anywhere else.
 */
export class RateLimiter {
	readonly #name: string;
	readonly #options: LimiterOptions;
	readonly #hits = new Map<string, number[]>();
	#settings: Settings | null = null;

	constructor(name: string, options: LimiterOptions) {
		this.#name = name;
		this.#options = options;
	}

	/** Read on first use: `$env/dynamic/private` only fills up once the server is running. */
	get #config(): Settings {
		return (this.#settings ??= {
			enabled: env.RATE_LIMIT?.trim().toLowerCase() !== 'off',
			requests: positiveNumber(`RATE_LIMIT_${this.#name.toUpperCase()}`, this.#options.limit),
			windowMs: positiveNumber('RATE_LIMIT_WINDOW', DEFAULT_WINDOW_SECONDS) * 1000
		});
	}

	/**
	 * `getClientAddress()` throws when `ADDRESS_HEADER` names a header the request did not carry.
	 * Turning every request away - the checker included - would be a worse answer to a
	 * misconfiguration than saying so once and letting the traffic through.
	 */
	#addressOf(getClientAddress: () => string): string | null {
		try {
			return getClientAddress();
		} catch (error: unknown) {
			if (!warnedAboutAddress) {
				warnedAboutAddress = true;
				console.warn(
					'[rateLimit] no client address, rate limiting is off:',
					errorMessage(error, 'unknown cause')
				);
			}
			return null;
		}
	}

	/**
	 * A 429 carrying `Retry-After` when the caller is over budget, `null` when the request may go
	 * ahead. A rejected request is not counted, so the wait it reports is the wait that actually
	 * gets the caller back in. This call *is* the count - use it once per request, as a guard.
	 */
	reject(getClientAddress: () => string): Response | null {
		const { enabled, requests, windowMs } = this.#config;
		if (!enabled) return null;

		const address = this.#addressOf(getClientAddress);
		if (address === null) return null;

		const now = Date.now();
		const recent = (this.#hits.get(address) ?? []).filter((at) => now - at < windowMs);

		if (recent.length >= requests) {
			this.#hits.set(address, recent);
			return new Response(this.#options.message, {
				status: 429,
				headers: {
					'Retry-After': String(Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000))),
					'Content-Type': 'text/plain; charset=utf-8'
				}
			});
		}

		recent.push(now);
		if (this.#hits.size > MAX_TRACKED) this.#hits.clear();
		this.#hits.set(address, recent);

		return null;
	}
}

/** A correction spends a model session and the better part of a minute; an event spends a row. */
export const checkLimiter = new RateLimiter('check', {
	limit: 10,
	message: 'Túl sok feladatot kaptunk túl rövid idő alatt. Várj egy kicsit, majd próbáld újra.'
});

export const analyticsLimiter = new RateLimiter('analytics', {
	limit: 30,
	message: 'Too many requests'
});

export const submissionLimiter = new RateLimiter('submissions', {
	limit: 5,
	message: 'Túl sok beküldés rövid idő alatt. Kérlek, várj egy kicsit.'
});

/**
 * How much work may be in flight at once, across every caller. The window limiter is per
 * address and a flood from many addresses walks straight past it; this is the one that keeps a
 * busy minute from turning into an unbounded provider bill.
 */
export class ConcurrencyLimit {
	readonly #name: string;
	readonly #fallback: number;
	#active = 0;
	#max: number | null = null;

	constructor(name: string, fallback: number) {
		this.#name = name;
		this.#fallback = fallback;
	}

	/**
	 * A release function, or `null` when the service is already full. The caller must invoke it
	 * on every exit path - it is safe to call twice, and a permit that is never returned is one
	 * the process never gets back.
	 */
	acquire(): (() => void) | null {
		this.#max ??= positiveNumber(
			`RATE_LIMIT_CONCURRENT_${this.#name.toUpperCase()}`,
			this.#fallback
		);
		if (this.#active >= this.#max) return null;

		this.#active++;
		let released = false;

		return () => {
			if (released) return;
			released = true;
			this.#active--;
		};
	}
}

export const checkConcurrency = new ConcurrencyLimit('checks', 8);
