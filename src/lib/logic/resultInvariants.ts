import type { Result } from '../llm/promptConfig';

/**
 * Everything below is decidable from the input and the parts, so none of it needs a model
 * turn. Anything that needs judgement does not belong here.
 */

export function joinParts(result: Result) {
	return result.resultParts
		.filter((part) => part.type !== 'removed')
		.map((part) => part.text)
		.join('');
}

/** Count how many times a pattern matches */
function count(text: string, pattern: RegExp) {
	return text.match(pattern)?.length ?? 0;
}

const GLUED_SENTENCE = /[.!?…][\p{Lu}\p{Ll}]/gu;
const DOUBLE_SPACE = /\p{L} {2,}\p{L}/gu;

/** Returns a complaint to send back to the model, or undefined if the result is well formed. */
export default function checkResultInvariants(input: string, result: Result): string | undefined {
	const parts = result.resultParts;

	if (parts.length === 0)
		return 'The result had no parts. Every word of the input has to end up in some part.';

	const empty = parts.findIndex((part) => part.text === '');
	if (empty !== -1)
		return `Part ${empty + 1} has empty text. Drop the part instead of sending an empty one.`;

	// removed parts are exempt: taking out a duplicated "a " has to take its space with it
	const padded = parts.find(
		(part) => (part.type === 'corrected' || part.type === 'added') && part.text !== part.text.trim()
	);
	if (padded)
		return (
			`The ${padded.type} part ${JSON.stringify(padded.text)} starts or ends with a space. ` +
			`A part that is not original covers exactly the text that changed: move the space into the neighbouring original part.`
		);

	const invented = parts.find((part) => part.type === 'original' && !input.includes(part.text));
	if (invented)
		return (
			`The part ${JSON.stringify(invented.text)} is marked original, but that text is not in the input. ` +
			`Mark it corrected or added, or quote the input exactly.`
		);

	const joined = joinParts(result);

	if (count(joined, GLUED_SENTENCE) > count(input, GLUED_SENTENCE))
		return (
			'In the joined result a sentence-ending full stop is followed straight away by a letter, with the space lost ' +
			'between two parts. Join the parts yourself and check: every part boundary has to keep the spacing the input had.'
		);

	if (count(joined, DOUBLE_SPACE) > count(input, DOUBLE_SPACE))
		return 'The joined result has a double space that the input did not have, at a part boundary.';

	// On short inputs (e.g. "tely" -> "tej") it's a 0.75 yield, and complaining about it would make
	// the model pad the words back ("telyj").
	if (input.length >= 120 && joined.length < input.length * 0.8)
		return (
			`The joined result is much shorter than the input (${joined.length} characters against ${input.length}). ` +
			`Something was left out. What you genuinely take out is a removed part that says why; nothing may simply disappear.`
		);

	return undefined;
}
