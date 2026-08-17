import { describe, expect, it } from 'vitest';
import { ResponseCache } from '$lib/scraper-new/responseCache';

describe('ResponseCache', () => {
	it('answers the second ask without loading again', async () => {
		let loads = 0;
		const cache = new ResponseCache<string>();
		const load = async () => {
			loads++;
			return 'html';
		};

		expect(await cache.fetch('a', load)).toBe('html');
		expect(await cache.fetch('a', load)).toBe('html');
		expect(loads).toBe(1);
		expect(cache.stats).toMatchObject({ hits: 1, misses: 1, size: 1 });
	});

	it('keeps different urls apart', async () => {
		const cache = new ResponseCache<string>();
		expect(await cache.fetch('a', async () => 'first')).toBe('first');
		expect(await cache.fetch('b', async () => 'second')).toBe('second');
		expect(await cache.fetch('a', async () => 'other')).toBe('first');
	});

	// a chunked check fires its sentences at once, and they ask about overlapping words
	it('shares one request between concurrent callers', async () => {
		let loads = 0;
		const cache = new ResponseCache<string>();
		const load = async () => {
			loads++;
			await new Promise((resolve) => setTimeout(resolve, 10));
			return 'html';
		};

		const [one, two, three] = await Promise.all([
			cache.fetch('a', load),
			cache.fetch('a', load),
			cache.fetch('a', load)
		]);

		expect([one, two, three]).toEqual(['html', 'html', 'html']);
		expect(loads).toBe(1);
	});

	it('lets a failed load through and does not cache it', async () => {
		const cache = new ResponseCache<string>();
		await expect(cache.fetch('a', async () => Promise.reject(new Error('500')))).rejects.toThrow(
			'500'
		);
		expect(await cache.fetch('a', async () => 'recovered')).toBe('recovered');
	});

	it('expires an entry once it is older than the ttl', async () => {
		let clock = 0;
		const cache = new ResponseCache<string>(10, 1000, () => clock);

		expect(await cache.fetch('a', async () => 'first')).toBe('first');
		clock = 999;
		expect(await cache.fetch('a', async () => 'second')).toBe('first');
		clock = 1001;
		expect(await cache.fetch('a', async () => 'third')).toBe('third');
	});

	it('drops the least recently used entry when it is full', async () => {
		const cache = new ResponseCache<string>(2);
		await cache.fetch('a', async () => 'A');
		await cache.fetch('b', async () => 'B');
		await cache.fetch('a', async () => 'not used'); // 'a' is now the most recent
		await cache.fetch('c', async () => 'C'); // evicts 'b'

		expect(cache.stats.size).toBe(2);
		// 'a' survived because it was used again; 'b' did not
		expect(await cache.fetch('a', async () => 'reloaded')).toBe('A');
		expect(await cache.fetch('b', async () => 'reloaded')).toBe('reloaded');
	});

	it('forgets everything on clear', async () => {
		const cache = new ResponseCache<string>();
		await cache.fetch('a', async () => 'A');
		cache.clear();
		expect(cache.stats).toMatchObject({ hits: 0, misses: 0, size: 0 });
	});
});
