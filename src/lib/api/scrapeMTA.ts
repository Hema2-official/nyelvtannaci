import { AxiosError, isAxiosError } from 'axios';
import axiosInstance from './axiosConfig';
import { ToolNames } from './MTA.type';
import type {
	ToolName,
	KulonVagyEgybeResult,
	PossibleExplanation,
	ExplanationStep,
	HelyesEIgyResult,
	ElvalasztasResult
} from './MTA.type';
import optimizeForLLM from '$lib/utils/optimizeForLLM';

const MTA_BASE_URL = 'https://helyesiras.mta.hu';

function parseKulonVagyEgybe(doc: Document): KulonVagyEgybeResult[] {
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
					?.trim()
					.substring(0, step.textContent.lastIndexOf('['))
					.replace(/\n/g, ' ');
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

function parseHelyesEIgy(doc: Document): HelyesEIgyResult[] {
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
		if (unknownAttr === null) continue;
		const correct = unknownAttr.toLowerCase() !== 'yes';

		// parse suggestions and tips
		const parseLines = (element: Element | null) =>
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

function parseElvalasztas(doc: Document): ElvalasztasResult[] {
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

export default async function scrapeMTA(tool: ToolName, input: string) {
	try {
		// validate input
		if (!ToolNames.includes(tool)) throw new Error(`Unknown tool: ${tool}`);
		if (!input) throw new Error('Input is required');

		// POST to the API's proxy with the parameters
		const response = await axiosInstance.post<string>('/api/mta-proxy-new', { tool, input });

		// parse the HTML response
		const parser = new DOMParser();
		const doc = parser.parseFromString(response.data, 'text/html');
		const errorNode = doc.querySelector('parsererror');
		if (errorNode) throw new Error(errorNode.textContent ?? 'Failed to parse MTA HTML');

		// parse by tool
		switch (tool) {
			case 'kulonVagyEgybe':
				return parseKulonVagyEgybe(doc);
			case 'helyesEIgy':
				return parseHelyesEIgy(doc);
			case 'elvalasztas':
				return parseElvalasztas(doc);
			default:
				throw new Error(`Unknown tool: ${tool}`);
		}
	} catch (error) {
		if (!isAxiosError(error)) throw typeof error === 'string' ? new Error(error) : error;
		const axiosError = error as AxiosError;
		throw new Error(
			typeof axiosError.response?.data === 'string'
				? axiosError.response?.data
				: 'Failed to scrape MTA'
		);
	}
}
