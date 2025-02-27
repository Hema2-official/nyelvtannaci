export const ToolNames = ['kulonVagyEgybe', 'helyesEIgy', 'elvalasztas'] as const;
export type ToolName = (typeof ToolNames)[number];

/* Külön vagy egybe? */
export type ExplanationStep = {
	action: string;
	references: Record<string, string>;
};
export type PossibleExplanation = {
	help: string;
	steps: ExplanationStep[];
};
export type KulonVagyEgybeResult = {
	solution: string;
	possibleExplanations: PossibleExplanation[];
};
/* ================= */

/* Helyes-e így? */
export type HelyesEIgyResult = {
	expression: string;
	correct: boolean;
	suggestions: string[];
	tips: string[];
};
/* ============= */

/* Elválasztás */
export type ElvalasztasResult = string;
/* ============= */
