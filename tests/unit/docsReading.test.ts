import { describe, expect, it } from 'vitest';
import { DocsReading } from '$lib/utils/docsReading';

/** A visit that opened the page and is looking at the first section. */
function opened() {
	const reading = new DocsReading();
	reading.show(0);
	return reading;
}

describe('DocsReading', () => {
	it('counts nothing until the page is shown', () => {
		const reading = new DocsReading();
		reading.enter('mi-ez', 0);

		expect(reading.elapsedMs(5_000)).toBe(0);
		expect(reading.sectionMs(5_000)).toEqual({ 'mi-ez': 0 });
	});

	it('counts a section for as long as it is on screen', () => {
		const reading = opened();
		reading.enter('mi-ez', 0);
		reading.exit('mi-ez', 3_000);

		expect(reading.sectionMs(9_000)).toEqual({ 'mi-ez': 3_000 });
		expect(reading.elapsedMs(9_000)).toBe(9_000);
	});

	it('reports a section still on screen up to the moment it is asked', () => {
		const reading = opened();
		reading.enter('mi-ez', 1_000);

		expect(reading.sectionMs(4_000)).toEqual({ 'mi-ez': 3_000 });
	});

	it('adds up the time a section spends on screen more than once', () => {
		const reading = opened();
		reading.enter('korlatok', 0);
		reading.exit('korlatok', 1_000);
		reading.enter('korlatok', 5_000);
		reading.exit('korlatok', 5_500);

		expect(reading.sectionMs(9_000)).toEqual({ korlatok: 1_500 });
	});

	it('stops every clock while the page is hidden', () => {
		const reading = opened();
		reading.enter('hasznalat', 0);
		reading.hide(2_000);
		reading.show(60_000);
		reading.hide(61_000);

		// Two seconds before the tab was left, one after coming back - not the minute in between.
		expect(reading.elapsedMs(61_000)).toBe(3_000);
		expect(reading.sectionMs(61_000)).toEqual({ hasznalat: 3_000 });
	});

	it('resumes a section that was on screen when the page was hidden', () => {
		const reading = opened();
		reading.enter('hasznalat', 0);
		reading.hide(1_000);

		expect(reading.sectionMs(30_000)).toEqual({ hasznalat: 1_000 });

		reading.show(30_000);
		expect(reading.sectionMs(31_000)).toEqual({ hasznalat: 2_000 });
	});

	it('ignores a second show or hide, so a duplicate event costs nothing', () => {
		const reading = opened();
		reading.show(5_000);
		reading.hide(1_000);
		reading.hide(9_000);

		expect(reading.elapsedMs(9_000)).toBe(1_000);
	});

	it('ignores re-entering a section that is already on screen', () => {
		const reading = opened();
		reading.enter('mi-ez', 0);
		reading.enter('mi-ez', 2_000);

		expect(reading.sectionMs(3_000)).toEqual({ 'mi-ez': 3_000 });
	});

	it('ignores an exit for a section that was never entered', () => {
		const reading = opened();
		reading.exit('mi-ez', 3_000);

		expect(reading.sectionMs(3_000)).toEqual({});
	});

	/** The distinction the whole measurement rests on: skimmed past is not the same as unread. */
	it('tells a section scrolled past from one that was never reached', () => {
		const reading = opened();
		reading.enter('mi-ez', 0);
		reading.exit('mi-ez', 0);

		const dwell = reading.sectionMs(1_000);
		expect(dwell).toEqual({ 'mi-ez': 0 });
		expect('korlatok' in dwell).toBe(false);
	});

	it('banks everything on screen when the sections are settled', () => {
		const reading = opened();
		reading.enter('mi-ez', 0);
		reading.enter('hasznalat', 1_000);
		reading.settle(4_000);

		// Settled at four seconds, so asking later reports the same numbers.
		expect(reading.sectionMs(9_999)).toEqual({ 'mi-ez': 4_000, hasznalat: 3_000 });
	});

	it('rounds the milliseconds it reports, because they travel as integers', () => {
		const reading = opened();
		reading.enter('mi-ez', 0.2);

		expect(reading.sectionMs(1_000.9)).toEqual({ 'mi-ez': 1_001 });
		expect(reading.elapsedMs(1_000.9)).toBe(1_001);
	});
});
