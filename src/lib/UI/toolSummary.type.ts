// Type to contain intermediate information to show in the UI about what's happening rn
export type IntermediateSummary = {
	expression: string;
	correct: boolean;
	explanation?: string;
	shareLink?: string;
};
