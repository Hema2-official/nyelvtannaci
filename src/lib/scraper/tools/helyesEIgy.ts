import type { HTMLElement } from 'node-html-parser';
import type { Tool } from '../scraper.type';
import optimizeForLLM from '$lib/utils/optimizeForLLM';

export type HelyesEIgyResult = {
	expression: string;
	correct: boolean;
	suggestions: string[];
	tips: string[];
};

function parseHelyesEIgy(doc: HTMLElement): HelyesEIgyResult[] {
	// error cases:
	//  - result node has attribute "unknown"
	// results:
	//  - ul.result -> li (multi):
	//    - textContent.split('„')[1].split('”')[0]: expression
	//    - unknown="YES": unknown
	//    - .suggest_list -> li (multi) textContent.trim(): suggestions
	//    - .suggest_tips -> li (multi) textContent.trim(): tips

	const resultsNode = doc.querySelector('ul.result');
	if (!resultsNode) throw new Error('No results found');

	// get all the li elements inside the result node
	const results: HelyesEIgyResult[] = [];
	for (const resultNode of resultsNode.querySelectorAll('li')) {
		// find expression quoted in the result
		const firstLine = resultNode.textContent?.split('\n')[0];
		if (!firstLine || !firstLine.includes('„') || !firstLine.includes('”')) continue;
		const expression = firstLine.split('„')[1].split('”')[0];

		// find unknown
		const unknownAttr = resultNode.getAttribute('unknown');
		if (typeof unknownAttr !== 'string') continue;
		const correct = unknownAttr.toLowerCase() !== 'yes';

		// parse suggestions and tips
		const parseLines = (element: HTMLElement | null) =>
			element?.textContent
				?.split('\n') // split into lines
				.map((line) => line.trim()) // trim each line
				.join('\n') // join into a single string again
				.replace(/(?<!\n)\n(?!\n)/gm, ' ') // replace standalone newlines with a space
				.split('\n') // split into lines again
				.map(optimizeForLLM) // apply optimizations
				.filter(Boolean) ?? []; // filter out empty lines

		const suggestions = parseLines(resultNode.querySelector('.suggest_list'));
		const tips = parseLines(resultNode.querySelector('.suggest_tips'));

		results.push({ expression, correct, suggestions, tips });
	}

	if (results.length === 0) throw new Error('No results found: invalid elements in results list');
	return results;
}

export default {
	url: '/helyesiras/default/suggest',
	parse: parseHelyesEIgy
} as Tool<HelyesEIgyResult[]>;
