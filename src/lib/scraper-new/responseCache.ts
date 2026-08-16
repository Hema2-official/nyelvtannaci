/**
 * A small cache of MTA responses, keyed by request URL.
 *
 * The same word gets asked more than once and the answers do not move: a single session on a
 * paragraph opened with 26 tool calls, several of them repeats, and consecutive sessions on the
 * same text repeat all of them. The site also answers 500 to bursts, so every request skipped
 * is one less chance of a retry.
 *
 * Deliberately in-process and small. Nothing here needs to survive a restart, and a stale
 * answer to a spelling question is a worse failure than a slow one, so entries expire.
 */

type Entry<T> = { value: T; storedAt: number };

export type CacheStats = { hits: number; misses: number; size: number };

const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 60 * 60 * 1000;

export class ResponseCache<T> {
	#entries = new Map<string, Entry<T>>();
	#hits = 0;
	#misses = 0;

	constructor(
		private maxEntries = DEFAULT_MAX_ENTRIES,
		private ttlMs = DEFAULT_TTL_MS,
		/** Injectable so the tests do not have to wait an hour. */
		private now: () => number = () => Date.now()
	) {}

	get(key: string): T | undefined {
		const entry = this.#entries.get(key);

		if (!entry) {
			this.#misses++;
			return undefined;
		}

		if (this.now() - entry.storedAt > this.ttlMs) {
			this.#entries.delete(key);
			this.#misses++;
			return undefined;
		}

		// re-insert so the most recently used entry is last, and the first is the one to drop
		this.#entries.delete(key);
		this.#entries.set(key, entry);
		this.#hits++;
		return entry.value;
	}

	set(key: string, value: T) {
		this.#entries.delete(key);
		this.#entries.set(key, { value, storedAt: this.now() });

		while (this.#entries.size > this.maxEntries) {
			const oldest = this.#entries.keys().next();
			if (oldest.done) break;
			this.#entries.delete(oldest.value);
		}
	}

	/**
	 * Runs `load` unless the answer is already here. Concurrent callers asking for the same key
	 * share one request: a chunked check sends its sentences at the same moment, and they ask
	 * about overlapping words.
	 */
	async fetch(key: string, load: () => Promise<T>): Promise<T> {
		const cached = this.get(key);
		if (cached !== undefined) return cached;

		const inFlight = this.#inFlight.get(key);
		if (inFlight) return inFlight;

		const promise = load()
			.then((value) => {
				this.set(key, value);
				return value;
			})
			.finally(() => this.#inFlight.delete(key));

		this.#inFlight.set(key, promise);
		return promise;
	}

	#inFlight = new Map<string, Promise<T>>();

	get stats(): CacheStats {
		return { hits: this.#hits, misses: this.#misses, size: this.#entries.size };
	}

	clear() {
		this.#entries.clear();
		this.#inFlight.clear();
		this.#hits = 0;
		this.#misses = 0;
	}
}

/** The one the scrapers share. */
export const mtaResponseCache = new ResponseCache<string>();
