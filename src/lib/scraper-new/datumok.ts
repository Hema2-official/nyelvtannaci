import { MTA_BASE_URL } from '$env/static/private';
import { parse } from 'node-html-parser';
import scraperAxios, { getCached } from './scraperAxios';
import { z } from 'zod';
import type { IntermediateSummary } from '$lib/llm/toolSummary.type';
import type { LLMFunction } from '$lib/llm/llmFunction.type';
import { akhErrorMessage, parseAkhForms, type AkhForm } from './akhForms';

export const datumokParams = z.object({
	input: z.string().describe('A dátum ÉÉÉÉ-HH-NN alakban, pl. "2024-01-01"')
});

export type DatumokResult = AkhForm;

/** The site's own date input; anything else it simply rejects. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function generateUrl(input: string) {
	return scraperAxios.getUri({
		url: `${MTA_BASE_URL}/helyesiras/default/dates`,
		params: { q: input.trim() }
	});
}

export async function scrapeDatumok(args: z.infer<typeof datumokParams>): Promise<DatumokResult[]> {
	const input = args.input.trim();

	if (!ISO_DATE.test(input))
		throw new Error('A dátumot ÉÉÉÉ-HH-NN alakban kell megadni, pl. "2024-01-01"');

	const html = await getCached(generateUrl(input));
	const doc = parse(html);

	// "Hibás dátum!" for an impossible day such as 2024-02-30
	const error = akhErrorMessage(doc);
	if (error) throw new Error(error);

	const results = parseAkhForms(doc);
	if (results.length === 0) throw new Error('No results found: invalid elements in results list');
	return results;
}

function provideSummary(
	args: z.infer<typeof datumokParams>,
	results: DatumokResult[]
): IntermediateSummary[] {
	// One row for the whole query: a date has a dozen accepted forms, and listing each as its
	// own row would bury everything else in the analysis.
	return [
		{
			tool: 'datumok',
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

export const datumokFunction = {
	name: 'datumok' as const,
	description:
		'Egy dátum helyesen leírható alakjai, a toldalékos formákkal együtt (pl. „2024. január 1.”, „1-je”, „1-jén”, „1-jei”, „1-jéig”). A bemenet ÉÉÉÉ-HH-NN alakú, a válasz az összes elfogadható alakot felsorolja.',
	parameters: datumokParams,
	callback: scrapeDatumok,
	summarize: provideSummary
} satisfies LLMFunction<typeof datumokParams, DatumokResult[]>;
