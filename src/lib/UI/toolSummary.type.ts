/** Intermediate information to show in the UI about what's happening rn */
export type IntermediateSummary = {
	/** What the tool was asked about, when it is worth showing next to the answer. */
	query?: string;
	expression: string;
	/** Undefined when the tool suggests a form instead of judging the one it was given. */
	correct?: boolean;
	explanation?: string;
	shareLink?: string;
};
