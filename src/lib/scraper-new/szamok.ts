import { MTA_BASE_URL } from '$env/static/private';
import { parse } from 'node-html-parser';
import scraperAxios from './scraperAxios';
import { z } from 'zod';
import type { IntermediateSummary } from '$lib/UI/toolSummary.type';
import type { LLMFunction } from '$lib/llm/llmFunction.type';
import { akhErrorMessage, parseAkhForms, type AkhForm } from './akhForms';

export const szamokParams = z.object({
	input: z
		.string()
		.describe('A szám számjegyekkel, pl. "2024", "3,5" (tizedes tört) vagy "1/2" (tört)')
});

export type SzamokResult = AkhForm;

/** What the site accepts: a sign, digits, a dot, a slash or a decimal comma. */
const NUMERAL = /^[+-]?[\d.,/]+$/;

function generateUrl(input: string) {
	return scraperAxios.getUri({
		url: `${MTA_BASE_URL}/helyesiras/default/numerals`,
		params: { q: input.trim() }
	});
}

export async function scrapeSzamok(args: z.infer<typeof szamokParams>): Promise<SzamokResult[]> {
	const input = args.input.trim();

	if (!NUMERAL.test(input))
		throw new Error(
			'A számot számjegyekkel kell megadni; előjel, pont, perjel és tizedesvessző szerepelhet benne'
		);

	const response = await scraperAxios.get<string>(generateUrl(input));
	const doc = parse(response.data);

	const error = akhErrorMessage(doc);
	if (error) throw new Error(error);

	const results = parseAkhForms(doc);
	if (results.length === 0) throw new Error('No results found: invalid elements in results list');
	return results;
}

function provideSummary(
	args: z.infer<typeof szamokParams>,
	results: SzamokResult[]
): IntermediateSummary[] {
	return [
		{
			query: args.input.trim(),
			expression: results[0].form,
			correct: undefined,
			explanation: results
				.map((result) => (result.note ? `${result.form} - ${result.note}` : result.form))
				.join('\n'),
			shareLink: generateUrl(args.input)
		}
	];
}

export const szamokFunction: LLMFunction<typeof szamokParams, SzamokResult[]> = {
	name: 'szamok',
	description:
		'Egy szám betűvel leírt alakjai (pl. 2024 -> „kétezer-huszonnégy”), tizedes törtekkel és törtekkel együtt. A bemenet számjegyekkel írandó; a válasz megjelöli, ha egy alak nem sztenderd, vagy csak jelzői helyzetben használatos.',
	parameters: szamokParams,
	callback: scrapeSzamok,
	summarize: provideSummary
};
