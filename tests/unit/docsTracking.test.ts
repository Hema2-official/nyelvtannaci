import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocsReading } from '$lib/utils/docsReading';
import type { AnalyticsEventInput } from '$lib/utils/analyticsEvents';

/**
 * The handlers that stand between the browser and `DocsReading`.
 *
 * They are tested here because the browser turned out to be the one place they cannot be
 * checked: an `IntersectionObserver` reports nothing while the page is not being painted, so a
 * pane that has stopped drawing measures a visit as perfectly still. The fakes below say what
 * the browser would say, and assert that it lands where it should.
 */

const sent: AnalyticsEventInput[] = [];

vi.mock('$lib/api/analytics', () => ({
	track: (event: AnalyticsEventInput) => void sent.push(event),
	submit: vi.fn()
}));
vi.mock('$lib/utils/history.svelte', () => ({ historyDb: { history: { count: async () => 0 } } }));
vi.mock('$app/navigation', () => ({ afterNavigate: vi.fn() }));
vi.mock('$app/environment', () => ({ browser: true }));

const { reportSections, reportLink } = await import('$lib/utils/docsTracking.svelte');

beforeEach(() => {
	sent.length = 0;
});

describe('reportSections', () => {
	/**
	 * A reading already on screen, and a `cross` that says what the observer would say when a
	 * section moves past the edge of the viewport. The callback takes its own timestamps from
	 * `performance.now()`, so the reading is started from it too.
	 */
	function watching() {
		const reading = new DocsReading();
		reading.show(performance.now());

		const report = reportSections(reading);
		const cross = (id: string, isIntersecting: boolean) =>
			report(
				[{ target: { id }, isIntersecting }] as unknown as IntersectionObserverEntry[],
				{/* the callback never touches its observer */} as IntersectionObserver
			);

		return { reading, cross };
	}

	it('turns a section coming on screen into time spent on it', () => {
		const { reading, cross } = watching();

		cross('mi-ez', true);
		expect(Object.keys(reading.sectionMs(performance.now()))).toEqual(['mi-ez']);

		cross('mi-ez', false);

		// The clock stopped where it was: asking a minute later reports the same number.
		const stopped = reading.sectionMs(performance.now());
		expect(reading.sectionMs(performance.now() + 60_000)).toEqual(stopped);
	});

	it('ignores anything on the page that is not one of the docs sections', () => {
		const { reading, cross } = watching();

		// `bits-s2` is the select's own element, which sits inside the container.
		cross('bits-s2', true);
		expect(reading.sectionMs(performance.now())).toEqual({});
	});

	it('keeps a section that is reached twice on one running total', () => {
		const { reading, cross } = watching();

		cross('korlatok', true);
		cross('korlatok', false);
		const afterFirst = reading.sectionMs(performance.now())['korlatok'] ?? 0;

		cross('korlatok', true);
		expect(reading.sectionMs(performance.now())['korlatok']).toBeGreaterThanOrEqual(afterFirst);
	});
});

/** `reportLink` sorts the click target by `instanceof`, so the fakes have to be those types. */
class FakeElement {}
class FakeAnchor extends FakeElement {
	constructor(
		readonly href: string,
		private readonly section: string | null
	) {
		super();
	}

	getAttribute() {
		return this.href;
	}

	closest(selector: string) {
		if (selector !== 'section[id]') return this;
		return this.section === null ? null : { id: this.section };
	}
}

describe('reportLink', () => {
	function clickOn(href: string, section: string | null) {
		vi.stubGlobal('Element', FakeElement);
		vi.stubGlobal('HTMLAnchorElement', FakeAnchor);

		reportLink({ target: new FakeAnchor(href, section) } as unknown as MouseEvent);
	}

	it('reports an outbound link as its host, and where it was followed from', () => {
		clickOn('https://helyesiras.mta.hu/valami?q=1', 'mi-ez');

		expect(sent).toEqual([{ kind: 'docs_link', target: 'helyesiras.mta.hu', section: 'mi-ez' }]);
	});

	it('reports a link that stays on the page as its anchor', () => {
		clickOn('#kornyezeti-adatok', 'ellenorzesi-folyamat');

		expect(sent).toEqual([
			{ kind: 'docs_link', target: '#kornyezeti-adatok', section: 'ellenorzesi-folyamat' }
		]);
	});

	it('reports a link that sits outside any section without one', () => {
		clickOn('https://example.com/x', null);

		expect(sent).toEqual([{ kind: 'docs_link', target: 'example.com', section: undefined }]);
	});
});
