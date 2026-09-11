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

	const invented = parts.filter((part) => part.type === 'original' && !input.includes(part.text));
	if (invented.length)
		return (
			`${invented.length === 1 ? 'This part is' : `These ${invented.length} parts are`} marked original, ` +
			`but that text is not in the input: ${invented.map((part) => JSON.stringify(part.text)).join(', ')}. ` +
			`Mark each one corrected or added, or quote the input exactly. Check the others the same way before sending.`
		);

	const joined = joinParts(result);

	if (count(joined, GLUED_SENTENCE) > count(input, GLUED_SENTENCE))
		return (
			'In the joined result a sentence-ending full stop is followed straight away by a letter, with the space lost ' +
			'between two parts. Join the parts yourself and check: every part boundary has to keep the spacing the input had.'
		);

	if (count(joined, DOUBLE_SPACE) > count(input, DOUBLE_SPACE))
		return 'The joined result has a double space that the input did not have, at a part boundary.';

	// That is what makes the check safe on a short input, where a ratio alone is not: "tely" ->
	// "tej" accounts for three characters of four, and complaining about it once made the model
	// pad the word back to "telyj". A whole clause going missing is a different size of loss,
	// and it happens on short inputs too - "Ez a doboz kissebb, mint a másik." came back as
	// "Ez a doboz kisebb", with the rest in no part at all and nothing to catch it.
	const accounted = parts.reduce((total, part) => total + part.text.length, 0);
	const lost = input.length - accounted;
	if (lost > 12 && accounted < input.length * 0.85)
		return (
			`The parts account for only ${accounted} characters of the input's ${input.length}. ` +
			`Something was left out. What you genuinely take out is a removed part that says why; nothing may simply disappear.`
		);

	return undefined;
}
