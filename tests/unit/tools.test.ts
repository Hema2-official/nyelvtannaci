import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import scraperAxios from '$lib/scraper-new/scraperAxios';
import { elvalasztasFunction, scrapeElvalasztas } from '$lib/scraper-new/elvalasztas';
import { helyesEIgyFunction, scrapeHelyesEIgy } from '$lib/scraper-new/helyesEIgy';
import { kulonVagyEgybeFunction, scrapeKulonVagyEgybe } from '$lib/scraper-new/kulonVagyEgybe';

/** Make any request fail, so a test can prove no request was attempted. */
function refuseRequests() {
	return vi
		.spyOn(scraperAxios, 'get')
		.mockRejectedValue(new Error('the scraper reached the network with a rejected input'));
}

/**
 * Every scraper puts the model's argument straight into a URL, so the guard has to hold
 * before any request goes out. The mock is here to fail loudly if one ever slips through.
 */
describe.each([
	['kulon_vagy_egybe', scrapeKulonVagyEgybe],
	['helyes-e_igy', scrapeHelyesEIgy],
	['elvalasztas', scrapeElvalasztas]
])('%s input validation', (_name, scrape) => {
	let request: ReturnType<typeof refuseRequests>;

	beforeEach(() => {
		request = refuseRequests();
	});

	afterEach(() => vi.restoreAllMocks());

	it.each([
		['empty', ''],
		['markup', '<script>'],
		['a closing tag', 'szó</b>'],
		['a quote', "szó'"],
		['a double quote', 'szó"'],
		['a slash', 'szó/másik'],
		['a backslash', 'szó\\másik']
	])('rejects %s without asking the site', async (_label, input) => {
		await expect(scrape({ input })).rejects.toThrow();
		expect(request).not.toHaveBeenCalled();
	});
});

describe('tool definitions', () => {
	it('gives every tool a name and a description the model can act on', () => {
		for (const tool of [kulonVagyEgybeFunction, helyesEIgyFunction, elvalasztasFunction]) {
			expect(tool.name).toMatch(/^[a-z0-9_-]+$/i);
			expect(tool.description.length).toBeGreaterThan(20);
		}
	});

	it('explains the hyphenation notation, which the output alone does not', () => {
		// "he-lyes|-í-rás" only makes sense with the legend, and the legend is static,
		// so it belongs in the schema the model reads once rather than in every result
		expect(elvalasztasFunction.description).toContain(
			'a "-"-jel a lehetséges elválasztási határokat'
		);
		expect(elvalasztasFunction.description).toContain('szóösszetételi határokat jelöli');
	});
});
