import type { z } from 'zod';
import type { IntermediateSummary } from '$lib/llm/toolSummary.type';

/** A tool the model may call during a session. */
export type LLMFunction<
	Params extends z.ZodType = z.ZodType,
	ToolResult = unknown,
	Name extends string = string
> = {
	name: Name;
	description: string;
	parameters: Params;
	callback: (args: z.infer<Params>) => Promise<ToolResult>;
	summarize?: (args: z.infer<Params>, result: ToolResult) => IntermediateSummary[];
};
