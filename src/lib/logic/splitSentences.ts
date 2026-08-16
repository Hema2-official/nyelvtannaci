/**
 * Splits a text into sentences that can be checked independently.
 *
 * The split has to be lossless: joining every chunk's `text` and `trailing` back together, in
 * order, gives the input character for character. Anything less and the merge quietly drops
 * text, which is the one failure the reader cannot see.
 *
 * Hungarian punctuation makes this less obvious than it looks. A full stop is a sentence end
 * in "Bonyhádon. Följegyezték", an ordinal marker in "1848. március", part of an abbreviation
 * in "stb. Ez", and part of an initial in "Szabó D. Attila". Only the first is a boundary.
 */

/** Part of text to be checked independently */
export type Chunk = {
	/** Whitespace preceding the chunk */
	leading: string;
	/** The chunk itself */
	text: string;
	/** Whitespace following the chunk */
	trailing: string;
};

const COMMON_ABBR = new Set([
	'pl',
	'ún',
	'ill',
	'vö',
	'stb',
	'kb',
	'ti',
	'ún',
	'dr',
	'id',
	'ifj',
	'özv',
	'sz',
	'ny',
	'u',
	'krt',
	'tkp',
	'ún',
	'l',
	'vmi',
	'vki',
	'ea',
	'ker',
	'em',
	'db',
	'ft',
	'kr',
	'ún'
]);

const ROMAN = /^[IVXLCDM]+$/;

/** The word immediately before a full stop, without its punctuation. */
function tokenBefore(text: string, dotIndex: number) {
	let end = dotIndex;
	let start = end;
	while (start > 0 && /[\p{L}\p{N}]/u.test(text[start - 1])) start--;
	return text.slice(start, end);
}

/** Whether the full stop at `index` ends a sentence rather than marking something else. */
function isSentenceEnd(text: string, index: number, nextNonSpace: string | undefined) {
	// the text ends here
	if (nextNonSpace === undefined) return true;

	// a new sentence could start with a capital letter or a number
	if (nextNonSpace !== nextNonSpace.toUpperCase() || !/\p{L}/u.test(nextNonSpace)) return false;

	const token = tokenBefore(text, index);

	// numbers, e.g. "1848. Március"
	if (/^\p{N}+$/u.test(token)) return false;

	// roman numerals, e.g. "XIX. Század"
	if (ROMAN.test(token)) return false;

	// initials, e.g. "Szabó D. Attila"
	if (token.length === 1) return false;

	if (COMMON_ABBR.has(token.toLowerCase())) return false;

	return true;
}

/**
 * Splits into sentence chunks. A text with no boundary comes back as a single chunk, which is
 * what makes this safe to apply unconditionally.
 */
export default function splitSentences(input: string): Chunk[] {
	const chunks: Chunk[] = [];
	let sentenceStart = 0;

	for (let index = 0; index < input.length; index++) {
		if (!'.!?…'.includes(input[index])) continue;

		// run past "?!" and "..." so the whole cluster stays with the sentence
		let end = index;
		while (end + 1 < input.length && '.!?…'.includes(input[end + 1])) end++;

		let afterSpace = end + 1;
		while (afterSpace < input.length && /\s/.test(input[afterSpace])) afterSpace++;

		// a boundary needs whitespace after it, unless the text simply ends
		const hasGap = afterSpace > end + 1 || afterSpace >= input.length;
		if (!hasGap || !isSentenceEnd(input, index, input[afterSpace])) {
			index = end;
			continue;
		}

		const raw = input.slice(sentenceStart, end + 1);
		if (raw.trim())
			chunks.push({
				leading: raw.slice(0, raw.length - raw.trimStart().length),
				text: raw.trim(),
				trailing: input.slice(end + 1, afterSpace)
			});

		sentenceStart = afterSpace;
		index = afterSpace - 1;
	}

	// whatever is left over, including a sentence with no closing punctuation
	const rest = input.slice(sentenceStart);
	if (rest.trim())
		chunks.push({
			leading: rest.slice(0, rest.length - rest.trimStart().length),
			text: rest.trim(),
			trailing: rest.slice(rest.trimEnd().length)
		});

	return chunks;
}

/** Joining a split back up gives the input exactly. Worth asserting wherever it is used. */
export function joinChunks(chunks: Chunk[]) {
	return chunks.map((chunk) => chunk.leading + chunk.text + chunk.trailing).join('');
}
