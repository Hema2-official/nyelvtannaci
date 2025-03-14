import { MTA_BASE_URL } from '$env/static/private';
import { parse } from 'node-html-parser';
import scraperAxios from './scraperAxios';
import { z } from 'zod';
import type { IntermediateSummary } from '$lib/UI/toolSummary.type';
import type { LLMFunction } from '$lib/llm/promptConfig';

export const elvalasztasParams = z.object({
	input: z.string().describe('Elválasztandó szó vagy szavak')
});

export type ElvalasztasResult = string;

function generateUrl(input: string) {
	return scraperAxios.getUri({
		url: `${MTA_BASE_URL}/helyesiras/default/hyph`,
		params: { q: input.trim() }
	});
}

export async function scrapeElvalasztas(
	args: z.infer<typeof elvalasztasParams>
): Promise<ElvalasztasResult[]> {
	const { input } = args;

	if (!input) throw 'Input is required';
	if (!input || /[<>'"/\\]/.test(input)) throw 'Invalid input';

	// Execute the request
	const response = await scraperAxios.get<string>(generateUrl(input));

	const doc = parse(response.data);

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

function provideSummary(
	args: z.infer<typeof elvalasztasParams>,
	results: ElvalasztasResult[]
): IntermediateSummary[] {
	return results.map((result) => ({
		expression: result,
		correct: true,
		shareLink: generateUrl(args.input)
	}));
}

export const elvalasztasFunction: LLMFunction<typeof elvalasztasParams, ElvalasztasResult[]> = {
	name: 'elvalasztas',
	description: 'Szavak elválasztása a magyar helyesírás szabályai szerint.',
	parameters: elvalasztasParams,
	callback: scrapeElvalasztas,
	summarize: provideSummary
};
