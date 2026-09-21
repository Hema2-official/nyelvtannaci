import type { DocsSectionId } from './docsVocabulary';

/**
 * How long one visit spent on each section of the docs, and on the page as a whole.
 *
 * Every moment is handed in by the caller, so this knows nothing of the DOM and nothing of the
 * clock, which is what lets a test drive it. The clock stops while the page is hidden: a tab
 * left open overnight is not eight hours of reading, and neither are the sections standing
 * still in its viewport.
 */
export class DocsReading {
	/** On screen now — whether or not their time is running, which depends on the page. */
	readonly #onScreen = new Set<DocsSectionId>();
	/** Running now, and since when. Empty while the page is hidden. */
	readonly #since = new Map<DocsSectionId, number>();
	/**
	 * Milliseconds already banked. A section becomes a key the moment it is first reached, so a
	 * section scrolled straight past reads as a 0 rather than as an absence — which is the whole
	 * difference between "skimmed" and "never got there".
	 */
	readonly #banked = new Map<DocsSectionId, number>();

	#shownAt: number | null = null;
	#elapsed = 0;

	/** The page became visible. */
	show(at: number) {
		if (this.#shownAt !== null) return;
		this.#shownAt = at;
		for (const id of this.#onScreen) this.#since.set(id, at);
	}

	/** The page was hidden — every clock stops where it stands. */
	hide(at: number) {
		if (this.#shownAt === null) return;
		this.#elapsed += at - this.#shownAt;
		this.#shownAt = null;
		for (const id of [...this.#since.keys()]) this.#bank(id, at);
	}

	/** A section came on screen. */
	enter(id: DocsSectionId, at: number) {
		if (this.#onScreen.has(id)) return;
		this.#onScreen.add(id);
		this.#banked.set(id, this.#banked.get(id) ?? 0);
		if (this.#shownAt !== null) this.#since.set(id, at);
	}

	/** A section went off screen. */
	exit(id: DocsSectionId, at: number) {
		if (!this.#onScreen.delete(id)) return;
		this.#bank(id, at);
	}

	/** Everything leaves the screen at once, e.g. because the observer is being torn down. */
	settle(at: number) {
		for (const id of [...this.#onScreen]) this.exit(id, at);
	}

	/** Milliseconds the page has been visible for. */
	elapsedMs(at: number): number {
		return Math.round(this.#elapsed + (this.#shownAt === null ? 0 : at - this.#shownAt));
	}

	/** Milliseconds on screen per section, for every section the visit reached. */
	sectionMs(at: number): Partial<Record<DocsSectionId, number>> {
		const dwell: Partial<Record<DocsSectionId, number>> = {};
		for (const [id, banked] of this.#banked) {
			const since = this.#since.get(id);
			dwell[id] = Math.round(banked + (since === undefined ? 0 : at - since));
		}
		return dwell;
	}

	#bank(id: DocsSectionId, at: number) {
		const since = this.#since.get(id);
		if (since === undefined) return;
		this.#banked.set(id, (this.#banked.get(id) ?? 0) + (at - since));
		this.#since.delete(id);
	}
}
