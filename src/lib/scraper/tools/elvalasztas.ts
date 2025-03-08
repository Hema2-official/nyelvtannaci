import type { HTMLElement } from 'node-html-parser';
import type { Tool } from '../scraper.type';

export type ElvalasztasResult = string;

function parseElvalasztas(doc: HTMLElement): ElvalasztasResult[] {
	// error cases:
	//   - no ul.result element
	// results:
	//  - ul.result -> li (multi):
	//    - i element textContent.trim(): expression

	const resultsNode = doc.querySelector('ul.result');
	if (!resultsNode) throw new Error('No results found');

	const results: ElvalasztasResult[] = [];
	for (const resultNode of resultsNode.querySelectorAll('li')) {
		const expression = resultNode.querySelector('i')?.textContent?.trim();
		if (!expression) continue;
		results.push(expression);
	}
	if (results.length === 0) throw new Error('No results found: invalid elements in results list');
	return results;
}

export default {
	url: '/helyesiras/default/hyph',
	parse: parseElvalasztas
} as Tool<ElvalasztasResult[]>;
