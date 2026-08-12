import { MTA_BASE_URL } from '$env/static/private';
import optimizeForLLM from '$lib/utils/optimizeForLLM';
import type { HTMLElement } from 'node-html-parser';

/** One accepted way of writing something, as the site lists it. */
export type AkhForm = {
	form: string;
	references: string[];
	note?: string;
};

export function parseAkhForms(doc: HTMLElement): AkhForm[] {
	const forms: AkhForm[] = [];

	for (const item of doc.querySelectorAll('ul.result li')) {
		const text = item.textContent?.replace(/\s+/g, ' ').trim();
		if (!text) continue;

		const opened = text.indexOf('[');
		const closed = text.lastIndexOf(']');

		const form = (opened === -1 ? text : text.slice(0, opened)).trim();
		if (!form) continue;

		// store references with hrefs - we might want them later
		const fullReferences: Record<string, string> = {};
		for (const link of item.querySelectorAll('a')) {
			const key = link.textContent?.trim();
			const href = link.getAttribute('href');
			if (key && href) fullReferences[key] = MTA_BASE_URL + href;
		}

		// "(Nem része a sztenderd nyelvváltozatnak.)" and friends, kept but unwrapped
		const note = optimizeForLLM(
			closed === -1
				? ''
				: text
						.slice(closed + 1)
						.trim()
						.replace(/^\((.*)\)$/s, '$1')
		);

		forms.push({ form, references: Object.keys(fullReferences), ...(note ? { note } : {}) });
	}

	return forms;
}

/** Both tools report a rejected input in the same place. */
export function akhErrorMessage(doc: HTMLElement): string | undefined {
	return doc.querySelector('div.error2')?.textContent?.replace(/\s+/g, ' ').trim() || undefined;
}
