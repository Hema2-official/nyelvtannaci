import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import runSession from '$lib/llm/runSession';
import getProvider from '$lib/llm/provider';
import { developerPrompt } from '$lib/llm/promptConfig';
import { errorMessage } from '$lib/utils/errorMessage';
import { comparableText, conformanceProblem, correctedText, correctionCases } from './cases';
import type { Result } from '$lib/llm/promptConfig';

/**
 * The whole flow: prompt -> model -> MTA tools -> result. Every case is a real session,
 * so this suite costs tokens and takes minutes.
 *
 * It doubles as the benchmark. Point it at a different model through the usual env vars
 * (LLM_PROVIDER, LLM_MODEL, LLM_REASONING_EFFORT, ...), and each run drops a JSON file in
 * bench-results/ next to the pass/fail output. See tests/README.md.
 */
const repeats = Math.max(1, Number(process.env.BENCH_REPEATS ?? '1'));

/** A session is many model turns; it needs far longer than the default. */
const sessionTimeout = 600_000;

type Run = {
	case: string;
	inPrompt: boolean;
	run: number;
	passed: boolean;
	ms: number;
	/** How many times a tool actually ran. */
	toolCalls: number;
	/** What was asked of which tool, in order, as "tool: query". */
	queries: string[];
	expected: string;
	got: string;
	problem?: string;
	/**
	 * Kept only for a run that failed. A conformance problem is a fault in the parts rather
	 * than in the text - an explanation where there should be none, a part that is empty -
	 * and the joined text cannot show you any of that.
	 */
	parts?: Result['resultParts'];
};

const runs: Run[] = [];

/** The summaries carry no tool name, but the share link says which endpoint answered. */
function toolOf(shareLink: string | undefined) {
	if (shareLink?.includes('/kulegy')) return 'kulon_vagy_egybe';
	if (shareLink?.includes('/suggest')) return 'helyes-e_igy';
	if (shareLink?.includes('/hyph')) return 'elvalasztas';
	if (shareLink?.includes('/dates')) return 'datumok';
	if (shareLink?.includes('/numerals')) return 'szamok';
	return 'unknown';
}

const plan = correctionCases.flatMap((testCase) =>
	Array.from({ length: repeats }, (_, index) => ({ testCase, run: index + 1 }))
);

describe.sequential('correction flow', () => {
	it.each(plan)(
		'$testCase.name (run $run)',
		async ({ testCase, run }) => {
			const queries: string[] = [];
			let toolCalls = 0;
			const started = performance.now();

			let got = '';
			let problem: string | undefined;
			let parts: Result['resultParts'] | undefined;

			try {
				const result = await runSession(testCase.input, async (summaries) => {
					toolCalls++;
					const [summary] = summaries;
					queries.push(`${toolOf(summary?.shareLink)}: ${summary?.query ?? summary?.expression}`);
				});

				got = correctedText(result);
				parts = result.resultParts;
				problem =
					conformanceProblem(result) ??
					(comparableText(got) === comparableText(testCase.expected) ? undefined : 'mismatch');
			} catch (error: unknown) {
				problem = errorMessage(error, 'session threw');
			}

			const ms = Math.round(performance.now() - started);
			runs.push({
				case: testCase.name,
				inPrompt: testCase.inPrompt,
				run,
				passed: problem === undefined,
				ms,
				toolCalls,
				queries,
				expected: testCase.expected,
				got,
				problem,
				...(problem && parts ? { parts } : {})
			});

			// One assertion carrying both facts, so a failure shows the text and the reason at
			// once. The diff shows the compared form; the raw text is kept in the report.
			expect({ problem, text: comparableText(got) }).toEqual({
				problem: undefined,
				text: comparableText(testCase.expected)
			});
		},
		sessionTimeout
	);

	afterAll(() => {
		if (runs.length === 0) return;

		const provider = getProvider();
		const label = [provider.id, provider.model, provider.reasoningEffort]
			.filter(Boolean)
			.join('_')
			.replace(/[^a-z0-9._-]+/gi, '-');

		const report = {
			provider: {
				id: provider.id,
				model: provider.model,
				reasoningEffort: provider.reasoningEffort ?? null,
				structuredOutputs: provider.structuredOutputs,
				strictTools: provider.strictTools,
				maxTurns: provider.maxTurns
			},
			// so a benchmark can be tied to the prompt it was run against
			promptSha: createHash('sha256').update(developerPrompt).digest('hex').slice(0, 12),
			ranAt: new Date().toISOString(),
			repeats,
			summary: summarise(runs),
			runs
		};

		mkdirSync('bench-results', { recursive: true });
		const file = `bench-results/${label}_${report.ranAt.replace(/[:.]/g, '-')}.json`;
		writeFileSync(file, JSON.stringify(report, null, '\t'));

		// stdout directly, so --silent still shows the numbers
		process.stdout.write(`\n${renderTable(runs)}\n`);
		process.stdout.write(
			`${label} | prompt ${report.promptSha} | ` +
				`overall ${report.summary.passed}/${report.summary.total} | ` +
				`in-prompt ${report.summary.inPrompt.passed}/${report.summary.inPrompt.total} | ` +
				`unseen ${report.summary.unseen.passed}/${report.summary.unseen.total} | ` +
				`median ${report.summary.medianMs}ms\n${file}\n\n`
		);
	});
});

function summarise(all: Run[]) {
	const count = (subset: Run[]) => ({
		total: subset.length,
		passed: subset.filter((run) => run.passed).length
	});
	const times = all.map((run) => run.ms).sort((a, b) => a - b);

	return {
		...count(all),
		inPrompt: count(all.filter((run) => run.inPrompt)),
		unseen: count(all.filter((run) => !run.inPrompt)),
		medianMs: times[Math.floor(times.length / 2)] ?? 0,
		totalToolCalls: all.reduce((sum, run) => sum + run.toolCalls, 0)
	};
}

function renderTable(all: Run[]) {
	const width = Math.max(...all.map((run) => run.case.length));
	return all
		.map((run) =>
			[
				run.passed ? 'pass' : 'FAIL',
				run.case.padEnd(width),
				`${String(run.run).padStart(2)}`,
				`${String(run.ms).padStart(6)}ms`,
				`${String(run.toolCalls).padStart(3)} calls`,
				run.passed ? '' : `${run.problem}: ${JSON.stringify(run.got)}`
			].join('  ')
		)
		.join('\n');
}
