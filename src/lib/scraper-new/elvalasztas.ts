import { MTA_BASE_URL } from '$env/static/private';
import { parse } from 'node-html-parser';
import scraperAxios, { getCached } from './scraperAxios';
import { z } from 'zod';
import type { IntermediateSummary } from '$lib/llm/toolSummary.type';
import type { LLMFunction } from '$lib/llm/llmFunction.type';

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

	if (!input) throw new Error('Input is required');
	if (!input || /[<>'"/\\]/.test(input)) throw new Error('Invalid input');

	const html = await getCached(generateUrl(input));
	const doc = parse(html);

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
		tool: 'elvalasztas',
		query: args.input.trim(),
		expression: result,
		correct: undefined,
		shareLink: generateUrl(args.input)
	}));
}

export const elvalasztasFunction = {
	name: 'elvalasztas' as const,
	description:
		'Szavak elválasztása a magyar helyesírás szabályai szerint. (A kimenetben a "-"-jel a lehetséges elválasztási határokat, a "|-"-jel az elválasztási határokat és egyben szóösszetételi határokat jelöli.)',
	parameters: elvalasztasParams,
	callback: scrapeElvalasztas,
	summarize: provideSummary
} satisfies LLMFunction<typeof elvalasztasParams, ElvalasztasResult[]>;
