import { parse, type HTMLElement } from 'node-html-parser';
import { MTA_BASE_URL } from '$env/static/private';
import scraperAxios from './scraperAxios';
import optimizeForLLM from '$lib/utils/optimizeForLLM';
import { z } from 'zod';
import type { IntermediateSummary } from '$lib/UI/toolSummary.type';
import type { LLMFunction } from '$lib/llm/promptConfig';

export const helyesEIgyParams = z.object({
	input: z.string().describe('Ellenőrizendő szó')
});

export type HelyesEIgyResult = {
	expression: string;
	correct: boolean;
	suggestions: string[];
	tips: string[];
};

function generateUrl(input: string) {
	return scraperAxios.getUri({
		url: `${MTA_BASE_URL}/helyesiras/default/suggest`,
		params: { q: input.trim() }
	});
}

export async function scrapeHelyesEIgy(
	args: z.infer<typeof helyesEIgyParams>
): Promise<HelyesEIgyResult[]> {
	const { input } = args;

	if (!input) throw new Error('Input is required');
	if (!input || /[<>'"/\\]/.test(input)) throw new Error('Invalid input');

	const response = await scraperAxios.get<string>(generateUrl(input));

	const doc = parse(response.data);

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

function provideSummary(
	args: z.infer<typeof helyesEIgyParams>,
	results: HelyesEIgyResult[]
): IntermediateSummary[] {
	return results.map((result) => ({
		expression: result.expression,
		correct: result.correct,
		shareLink: generateUrl(args.input)
	}));
}

export const helyesEIgyFunction: LLMFunction<typeof helyesEIgyParams, HelyesEIgyResult[]> = {
	name: 'helyes-e_igy',
	description:
		'Szóalak helyességének vizsgálata (pl. mássalhangzó-, magánhangzó-hosszúság, ly/j használata), helytelen alakhoz helyes alakok javaslata.',
	parameters: helyesEIgyParams,
	callback: scrapeHelyesEIgy,
	summarize: provideSummary
};
