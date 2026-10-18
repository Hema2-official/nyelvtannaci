import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import runSession from '$lib/llm/runSession';
import getProvider from '$lib/llm/provider';
import { availableFunctions, developerPrompt, resultType } from '$lib/llm/promptConfig';
import { toChatCompletionTool, toParameterSchema } from '$lib/llm/toolSchema';
import { errorMessage } from '$lib/utils/errorMessage';
import { comparableText, conformanceProblem, correctedText, correctionCases } from './cases';
import type { Result } from '$lib/llm/promptConfig';
import type { IntermediateSummary } from '$lib/llm/toolSummary.type';

/**
 * The whole flow: prompt -> model -> MTA tools -> result. Every case is a real session,
 * so this suite costs tokens and takes minutes.
 *
 * It doubles as the benchmark. Point it at a different model through the usual env vars
 * (LLM_PROVIDER, LLM_MODEL, LLM_REASONING_EFFORT, ...), and each run drops a JSON file in
 * bench-results/ next to the pass/fail output. See tests/README.md.
 */
const repeats = Math.max(1, Number(process.env.BENCH_REPEATS ?? '1'));

/**
 * BENCH_CASES=tely,Ethernet runs only the cases whose name contains one of those, which is
 * what makes a sweep across many models affordable. Unset runs everything.
 */
const only = (process.env.BENCH_CASES ?? '')
	.split(',')
	.map((name) => name.trim().toLowerCase())
	.filter(Boolean);

const selectedCases = only.length
	? correctionCases.filter((testCase) =>
			only.some((name) => testCase.name.toLowerCase().includes(name))
		)
	: correctionCases;

if (selectedCases.length === 0) throw new Error(`BENCH_CASES matched no case: ${only.join(', ')}`);

/** A session is many model turns; it needs far longer than the default. */
const sessionTimeout = 600_000;

/**
 * A session still running when vitest gave up on it went on beside the next case, then landed
 * late - a pass recorded for a test vitest had already failed - or never, leaving a report one
 * run short that said `errored: 0`. So it is stopped a little earlier, and its run recorded as
 * errored.
 */
const sessionDeadline = sessionTimeout - 10_000;

/**
 * A stopped session still writes its session log on the way out, and after the last case the
 * process does not wait for it. This is how long it gets.
 */
const windDown = 5_000;

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
	/**
	 * The calls `queries` leaves out: the tool answered with an error, which the model was
	 * shown all the same. As "tool: query -> error".
	 */
	failedToolCalls?: string[];
	expected: string;
	got: string;
	problem?: string;
	/**
	 * The session never produced an answer at all - the provider refused, the connection
	 * dropped, the turns ran out. A run like that says nothing about the prompt, and counting
	 * it as a wrong answer is how a two-minute gateway outage once read as a regression.
	 */
	errored?: true;
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
	if (shareLink?.includes('/predict')) return 'nevkereso';
	if (shareLink?.includes('/dates')) return 'datumok';
	if (shareLink?.includes('/numerals')) return 'szamok';
	return 'unknown';
}

/**
 * helyes-e_igy reports no query, and its first expression is only the first word of what it
 * was sent; the share link carries all of it.
 */
function queryOf(summary: IntermediateSummary | undefined) {
	if (summary?.query) return summary.query;
	try {
		return new URL(summary?.shareLink ?? '').searchParams.get('q') ?? summary?.expression;
	} catch {
		return summary?.expression;
	}
}

/** The `input` every MTA tool takes, or the arguments as sent when there is none. */
function inputOf(rawArguments: string) {
	try {
		const { input } = JSON.parse(rawArguments) as { input?: unknown };
		if (typeof input === 'string') return input;
	} catch {
		// not even JSON, which is worth seeing as it came
	}
	return rawArguments.length > 200 ? `${rawArguments.slice(0, 200)}...` : rawArguments;
}

/** Rejects with the signal's reason once it aborts. */
function aborted(signal: AbortSignal) {
	return new Promise<never>((_, reject) =>
		signal.addEventListener('abort', () => reject(signal.reason), { once: true })
	);
}

/** Waits for a promise to settle either way, but no longer than `ms`. */
async function settled(promise: Promise<unknown>, ms: number) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	await Promise.race([
		promise.catch(() => {}),
		new Promise((resolve) => (timer = setTimeout(resolve, ms)))
	]);
	clearTimeout(timer);
}

const plan = selectedCases.flatMap((testCase) =>
	Array.from({ length: repeats }, (_, index) => ({ testCase, run: index + 1 }))
);

describe.sequential('correction flow', () => {
	it.each(plan)(
		'$testCase.name (run $run)',
		async ({ testCase, run }) => {
			const queries: string[] = [];
			const failedToolCalls: string[] = [];
			let toolCalls = 0;
			const started = performance.now();

			let got = '';
			let problem: string | undefined;
			let errored: true | undefined;
			let parts: Result['resultParts'] | undefined;

			const abort = new AbortController();
			const deadline = setTimeout(
				() => abort.abort(new Error(`stopped after ${sessionDeadline / 1000} s without an answer`)),
				sessionDeadline
			);
			const session = runSession(
				testCase.input,
				async (summaries) => {
					toolCalls++;
					const [summary] = summaries;
					queries.push(`${toolOf(summary?.shareLink)}: ${queryOf(summary)}`);
				},
				undefined,
				abort.signal,
				(call) => {
					if (call.error !== undefined)
						failedToolCalls.push(`${call.tool}: ${inputOf(call.arguments)} -> ${call.error}`);
				}
			);

			try {
				// the session itself stops at its next chance, which can be a tool call away
				const result = await Promise.race([session, aborted(abort.signal)]);

				got = correctedText(result);
				parts = result.resultParts;
				problem =
					conformanceProblem(result) ??
					(comparableText(got) === comparableText(testCase.expected) ? undefined : 'mismatch');
			} catch (error: unknown) {
				problem = errorMessage(error, 'session threw');
				errored = true;
			} finally {
				clearTimeout(deadline);
			}

			const ms = Math.round(performance.now() - started);
			if (abort.signal.aborted) await settled(session, windDown);

			runs.push({
				case: testCase.name,
				inPrompt: testCase.inPrompt,
				run,
				passed: problem === undefined,
				ms,
				toolCalls,
				// copies: a stopped session that outlives its wind-down could still add to these
				queries: [...queries],
				...(failedToolCalls.length ? { failedToolCalls: [...failedToolCalls] } : {}),
				expected: testCase.expected,
				got,
				problem,
				...(errored ? { errored } : {}),
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
				temperature: provider.temperature ?? null,
				structuredOutputs: provider.structuredOutputs,
				strictTools: provider.strictTools,
				extraBody: provider.extraBody ?? null,
				completionCap: provider.completionCap ?? null,
				timeoutMs: provider.timeoutMs ?? null,
				maxTurns: provider.maxTurns
			},
			// so a benchmark can be tied to what the model was actually given
			promptSha: modelInputSha(),
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
				(report.summary.errored
					? `NOT COMPARABLE: ${report.summary.errored} session(s) never ran | `
					: '') +
				`median ${report.summary.medianMs}ms\n${file}\n\n`
		);
	});
});

function modelInputSha() {
	const given = {
		prompt: developerPrompt,
		result: toParameterSchema(resultType, true),
		tools: availableFunctions.map((tool) => toChatCompletionTool(tool, true))
	};
	return createHash('sha256').update(JSON.stringify(given)).digest('hex').slice(0, 12);
}

function summarise(all: Run[]) {
	const count = (subset: Run[]) => ({
		total: subset.length,
		passed: subset.filter((run) => run.passed).length
	});
	const times = all.map((run) => run.ms).sort((a, b) => a - b);

	return {
		...count(all),
		// sessions that never ran, kept apart from answers that were wrong
		errored: all.filter((run) => run.errored).length,
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
				run.errored ? '????' : run.passed ? 'pass' : 'FAIL',
				run.case.padEnd(width),
				`${String(run.run).padStart(2)}`,
				`${String(run.ms).padStart(6)}ms`,
				`${String(run.toolCalls).padStart(3)} calls`,
				run.errored
					? `errored: ${run.problem}`
					: run.passed
						? ''
						: `${run.problem}: ${JSON.stringify(run.got)}`
			].join('  ')
		)
		.join('\n');
}
