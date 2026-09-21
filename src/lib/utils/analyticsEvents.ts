import { z } from 'zod';
import { personalDataLabels, type PersonalDataKind } from '$lib/utils/personalData';
import { docsSectionIds, readerTypes } from '$lib/utils/docsVocabulary';

const personalDataKind = z.enum(
	Object.keys(personalDataLabels) as [PersonalDataKind, ...PersonalDataKind[]]
);

const detectedCounts = z.partialRecord(personalDataKind, z.number().int().nonnegative());

const docsSection = z.enum(docsSectionIds);
const readerType = z.enum(readerTypes);

const sectionDwell = z.partialRecord(docsSection, z.number().int().nonnegative());

export const analyticsEvent = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('history_open') }),
	z.object({ kind: z.literal('history_delete') }),
	z.object({ kind: z.literal('copy') }),
	z.object({
		kind: z.literal('warning'),
		detected: detectedCounts,
		/** `dismissed` is Escape or a click outside - neither button was pressed. */
		outcome: z.enum(['proceeded', 'edit', 'dismissed'])
	}),
	z.object({
		kind: z.literal('docs_open'),
		entry: z.enum(['direct', 'in-app']),
		section: docsSection.optional(),
		reader: readerType,
		checked: z.boolean().optional()
	}),
	z.object({
		kind: z.literal('docs_reader'),
		to: readerType
	}),
	z.object({
		kind: z.literal('docs_link'),
		target: z.string().max(100),
		section: docsSection.optional()
	}),
	z.object({
		kind: z.literal('docs_read'),
		ms: z.number().int().nonnegative(),
		reader: readerType,
		sections: sectionDwell
	}),
	z.object({
		kind: z.literal('report'),
		input: z.string().max(20_000),
		summaries: z.array(z.unknown()).default([]),
		result: z.unknown(),
		message: z.string().max(2_000).optional()
	}),
	z.object({
		kind: z.literal('feedback'),
		message: z.string().min(1).max(5_000)
	})
]);

/** What `record` stores, once the schema has filled in its defaults. */
export type AnalyticsEvent = z.infer<typeof analyticsEvent>;

/** What the client sends, where those defaults are still optional. */
export type AnalyticsEventInput = z.input<typeof analyticsEvent>;

export type SubmissionEventInput = Extract<AnalyticsEventInput, { kind: 'report' | 'feedback' }>;

export type TelemetryEventInput = Exclude<AnalyticsEventInput, SubmissionEventInput>;
