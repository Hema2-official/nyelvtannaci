import type { HTMLElement } from 'node-html-parser';
import type { Tool } from '../scraper.type';
import { MTA_BASE_URL } from '$env/static/private';

export type ExplanationStep = {
	action: string;
	references: Record<string, string>;
};
export type PossibleExplanation = {
	help: string;
	steps: ExplanationStep[];
};
export type KulonVagyEgybeResult = {
	solution: string;
	possibleExplanations: PossibleExplanation[];
};

function parseKulonVagyEgybe(doc: HTMLElement): KulonVagyEgybeResult[] {
	// error cases:
	//  - contains .result.error
	//  - contains .result.result-noresult

	const errorNode = doc.querySelector('.result.error');
	if (errorNode) {
		const message = errorNode.textContent?.trim();
		if (!message) throw 'A karakterláncot sajnos nem tudtuk értelmezni.';
		throw message
			.substring(message.indexOf('\n') + 1)
			.replace(/\s+/g, ' ')
			.trim();
	}

	if (doc.querySelector('.result.result-noresult'))
		// part of the official error message
		throw 'A megadott bemenetre automatikus eszközeinkkel sajnos nem tudtunk megfelelő tanáccsal szolgálni.';

	// results:
	//  - #result_xhtml -> .solution (multi):
	//    - .sol_summary (textContent.trim().replaceAll('"', '')): solution
	//    - .explanation (multi):
	//      - .expl_help (textContent.trim()): help
	//      - .step_body (multi):
	//        - textContent.trim()
	//            .substring(0, textContent.lastIndexOf('['))
	//            .replaceAll('\n', ' '): action
	//        - .alink (multi):
	//          - textContent.trim(): reference key
	//          - href: reference value

	const results: KulonVagyEgybeResult[] = [];
	for (const resultNode of doc.querySelectorAll('#result_xhtml .solution')) {
		const solution = resultNode
			.querySelector('.sol_summary')
			?.textContent?.trim()
			.replace(/"/g, '');
		if (!solution) continue;

		// parse possible explanations
		const possibleExplanations: PossibleExplanation[] = [];
		for (const explanationNode of resultNode.querySelectorAll('.explanation')) {
			// help CAN be empty
			const help = explanationNode.querySelector('.expl_help')?.textContent?.trim() ?? '';

			// parse steps
			const steps: ExplanationStep[] = [];
			for (const step of explanationNode.querySelectorAll('.step_body')) {
				const action = step.textContent
					?.substring(0, step.textContent.lastIndexOf('['))
					.replace(/\n/g, ' ')
					.replace(/ {2,}/g, ' ') // remove multiple spaces between words
					.trim();
				if (!action) continue;

				const references: Record<string, string> = {};
				for (const reference of step.querySelectorAll('.alink')) {
					const key = reference.textContent?.trim();
					const value = reference.getAttribute('href');
					if (key && value) references[key] = MTA_BASE_URL + value; // # URL optimization
				}
				steps.push({ action, references });
			}
			possibleExplanations.push({ help, steps });
		}
		results.push({ solution, possibleExplanations });
	}
	if (results.length === 0) throw new Error('No results found: invalid elements in results list');
	return results;
}

export default {
	url: '/helyesiras/default/kulegy',
	parse: parseKulonVagyEgybe
} as Tool<KulonVagyEgybeResult[]>;
