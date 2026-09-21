import type { AfterNavigate } from '@sveltejs/kit';
import { afterNavigate } from '$app/navigation';
import { browser } from '$app/environment';
import {
	IsDocumentVisible,
	IsIdle,
	onCleanup,
	useEventListener,
	useIntersectionObserver,
	watch,
	type Getter
} from 'runed';
import { track } from '$lib/api/analytics';
import { historyDb } from '$lib/utils/history.svelte';
import { DocsReading } from '$lib/utils/docsReading';
import { isDocsSectionId, type ReaderType } from '$lib/utils/docsVocabulary';

function safely<T extends unknown[]>(fn: (...args: T) => void) {
	return (...args: T) => {
		try {
			fn(...args);
		} catch (error: unknown) {
			console.debug('[docs analytics]', error);
		}
	};
}

/** Margins to detect the currently viewed section based on. */
const VIEWPORT_MARGIN = '-15% 0px -15% 0px';

/** How long before the clock stops when the user is idle */
const IDLE_TIMEOUT_MS = 120_000;

export const trackDocs = safely(measureVisit);

export const reportReader = safely((to: ReaderType) => track({ kind: 'docs_reader', to }));

function measureVisit(container: Getter<HTMLElement | undefined>, reader: Getter<ReaderType>) {
	const reading = new DocsReading();
	const visible = new IsDocumentVisible();

	const idle = browser
		? new IsIdle({ timeout: IDLE_TIMEOUT_MS, detectVisibilityChanges: true })
		: null;

	let sent = false;
	const finish = safely(() => {
		if (sent) return;
		sent = true;

		const at = performance.now();
		track({
			kind: 'docs_read',
			ms: reading.elapsedMs(at),
			reader: reader(),
			sections: reading.sectionMs(at)
		});
	});

	reportOpen(reader);

	// The clock runs while the page is on screen and the reader is still moving. Both `show` and
	// `hide` ignore a call that changes nothing, so the first run needs no special case.
	watch(
		() => visible.current && !idle?.current,
		safely((active) => (active ? reading.show(performance.now()) : reading.hide(performance.now())))
	);

	// Going idle only stops the clock; it is the page leaving the screen that ends the visit.
	watch(
		() => visible.current,
		safely((isVisible: boolean, wasVisible: boolean | undefined) => {
			// The first run reports the state the page loaded in, and a tab opened in the
			// background has not ended a visit it never began.
			if (isVisible || wasVisible === undefined) return;
			finish();
		})
	);

	useEventListener(() => window, 'pagehide', finish);
	onCleanup(
		safely(() => {
			reading.hide(performance.now());
			finish();
		})
	);

	let sections = $state<HTMLElement[]>([]);
	watch(
		[container, reader],
		safely(([element]: [HTMLElement | undefined, ReaderType]) => {
			// Whatever is on screen is banked before the observer is pointed at the new nodes.
			reading.settle(performance.now());
			sections = element ? [...element.querySelectorAll<HTMLElement>('section[id]')] : [];
		})
	);

	useIntersectionObserver(() => sections, safely(reportSections(reading)), {
		rootMargin: VIEWPORT_MARGIN,
		// The native default. Runed's own is 0.1, which would wait for a tenth of a section.
		threshold: 0
	});

	useEventListener(container, 'click', safely(reportLink));
}

/** The visit began (sent once, whatever the reader does afterwards) */
function reportOpen(reader: Getter<ReaderType>) {
	let opened = false;

	afterNavigate(
		safely((navigation: AfterNavigate) => {
			// It fires again for every jump to a section hash; only the arrival is the visit.
			if (opened) return;
			opened = true;

			const section = navigation.to?.url.hash.slice(1);
			historyDb.history
				.count()
				.then((entries) => entries > 0)
				.catch(() => undefined)
				.then((checked) =>
					track({
						kind: 'docs_open',
						entry: navigation.type === 'enter' ? 'direct' : 'in-app',
						section: isDocsSectionId(section) ? section : undefined,
						reader: reader(),
						checked
					})
				);
		})
	);
}

export function reportSections(reading: DocsReading): IntersectionObserverCallback {
	return (entries) => {
		const at = performance.now();
		for (const { target, isIntersecting } of entries) {
			if (!isDocsSectionId(target.id)) continue;
			if (isIntersecting) reading.enter(target.id, at);
			else reading.exit(target.id, at);
		}
	};
}

/** Tracks clicked links via event delegation, recording anchor hashes or outbound hostnames */
export function reportLink(event: MouseEvent) {
	const clicked = event.target;
	const link = clicked instanceof Element ? clicked.closest('a[href]') : null;
	if (!(link instanceof HTMLAnchorElement)) return;

	const section = link.closest('section[id]')?.id;
	const href = link.getAttribute('href') ?? '';

	track({
		kind: 'docs_link',
		target: href.startsWith('#') ? href : new URL(link.href).host,
		section: isDocsSectionId(section) ? section : undefined
	});
}
