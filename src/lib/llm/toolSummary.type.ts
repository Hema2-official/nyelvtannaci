import type { AvailableFunctionName } from './promptConfig';

/** Intermediate information to show in the UI about what's happening rn */
export type IntermediateSummary = {
	tool: AvailableFunctionName;
	expression: string;
	/** What the tool was asked about, when it is worth showing next to the answer. */
	query?: string;
	/** Undefined when the tool suggests a form instead of judging the one it was given. */
	correct?: boolean;
	explanation?: string;
	shareLink?: string;
};
