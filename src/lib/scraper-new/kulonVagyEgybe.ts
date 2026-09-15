import { parse } from 'node-html-parser';
import { MTA_BASE_URL } from '$env/static/private';
import optimizeForLLM from '$lib/utils/optimizeForLLM';
import scraperAxios, { getCached } from './scraperAxios';
import { z } from 'zod';
import type { IntermediateSummary } from '$lib/llm/toolSummary.type';
import type { LLMFunction } from '$lib/llm/llmFunction.type';

export const kulonVagyEgybeParams = z.object({
	input: z.string().describe('Kérdéses szavak szóközzel elválasztva')
});

export type ExplanationStep = {
	action: string;
	references: string[];
};
export type PossibleExplanation = {
	help: string;
	steps: ExplanationStep[];
};
export type KulonVagyEgybeResult = {
	solution: string;
	outdated?: true;
	possibleExplanations: PossibleExplanation[];
};

/** The site's own wording for a spelling the 12th edition dropped. */
const OUTDATED_MARKER = 'Már nem érvényes írásmód';

function generateUrl(input: string) {
	return scraperAxios.getUri({
		url: `${MTA_BASE_URL}/helyesiras/default/kulegy`,
		params: { q: input.trim() }
	});
}

export async function scrapeKulonVagyEgybe(
	args: z.infer<typeof kulonVagyEgybeParams>
): Promise<KulonVagyEgybeResult[]> {
	const { input } = args;

	if (!input) throw new Error('Input is required');
	if (!input || /[<>'"/\\]/.test(input)) throw new Error('Invalid input');

	const results = await fetchSolutions(input);

	const query = input.trim();
	for (const result of results) {
		if (result.possibleExplanations.some((e) => e.steps.length || e.help)) continue;
		if (!result.solution.includes(' ') || result.solution === query) continue;

		// Re-run query when there may be missing information because of the query's nature
		const reasked = await fetchSolutions(result.solution).catch(() => []);
		const match = reasked.find((r) => r.solution === result.solution);
		if (!match) continue;

		result.possibleExplanations = match.possibleExplanations;
		if (match.outdated) result.outdated = true;
	}

	return results;
}

async function fetchSolutions(input: string): Promise<KulonVagyEgybeResult[]> {
	const html = await getCached(generateUrl(input));
	const doc = parse(html);

	// error cases:
	//  - contains .result.error
	//  - contains .result.result-noresult

	const errorNode = doc.querySelector('.result.error');
	if (errorNode) {
		const message = errorNode.textContent?.trim();
		if (!message) throw new Error('A karakterláncot sajnos nem tudtuk értelmezni.');
		throw message
			.substring(message.indexOf('\n') + 1)
			.replace(/\s+/g, ' ')
			.trim();
	}

	if (doc.querySelector('.result.result-noresult'))
		// part of the official error message
		throw new Error(
			'A megadott bemenetre automatikus eszközeinkkel sajnos nem tudtunk megfelelő tanáccsal szolgálni.'
		);

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
			const help = optimizeForLLM(
				explanationNode.querySelector('.expl_help')?.textContent?.trim() ?? ''
			);

			// parse steps
			const steps: ExplanationStep[] = [];
			for (const step of explanationNode.querySelectorAll('.step_body')) {
				const action = optimizeForLLM(
					step.textContent
						?.substring(0, step.textContent.lastIndexOf('['))
						.replace(/\n/g, ' ')
						.replace(/ {2,}/g, ' ') // remove multiple spaces between words
						.trim()
				);
				if (!action) continue;

				// references with HREFs, might need later
				const fullReferences: Record<string, string> = {};
				for (const reference of step.querySelectorAll('.alink')) {
					const key = reference.textContent?.trim();
					const value = reference.getAttribute('href');
					if (key && value) fullReferences[key] = MTA_BASE_URL + value; // # URL optimization
				}
				steps.push({ action, references: Object.keys(fullReferences) });
			}
			possibleExplanations.push({ help, steps });
		}
		const outdated = possibleExplanations.some((explanation) =>
			explanation.steps.some((step) => step.action.includes(OUTDATED_MARKER))
		);
		results.push({
			solution,
			...(outdated && { outdated: true as const }),
			possibleExplanations
		});
	}
	if (results.length === 0) throw new Error('No results found: invalid elements in results list');
	return results;
}

function formatExplanations(possibleExplanations: PossibleExplanation[]): string {
	const branches = possibleExplanations
		.map(({ help, steps }) =>
			[help, ...steps.map((step) => step.action)].filter(Boolean).join('\n')
		)
		.filter(Boolean);

	// several readings of the same input: show that there was a choice to make, don't hide it
	if (branches.length > 1)
		return branches.map((branch, i) => `${i + 1}. lehetséges elemzés:\n${branch}`).join('\n\n');

	return branches[0] ?? '';
}

function provideSummary(
	args: z.infer<typeof kulonVagyEgybeParams>,
	results: KulonVagyEgybeResult[]
): IntermediateSummary[] {
	return results.map((result) => ({
		tool: 'kulon_vagy_egybe',
		query: args.input.trim(),
		expression: result.solution,
		correct: undefined,
		explanation: formatExplanations(result.possibleExplanations) || undefined,
		shareLink: generateUrl(args.input)
	}));
}

export const kulonVagyEgybeFunction = {
	name: 'kulon_vagy_egybe' as const,
	description:
		'A megadott szavak vizsgálata és javaslattétel arra, hogy hogyan lehet őket leírni (külön, egybe vagy kötőjellel).',
	parameters: kulonVagyEgybeParams,
	callback: scrapeKulonVagyEgybe,
	summarize: provideSummary
} satisfies LLMFunction<typeof kulonVagyEgybeParams, KulonVagyEgybeResult[]>;
