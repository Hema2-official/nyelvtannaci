import type { Result } from './promptConfig';
import { joinParts } from './resultInvariants';

/**
 * The last turn: the model reads its own answer as text.
 *
 * It emits parts and never sees them joined, so defects that live in the concatenation are
 * invisible to it - a lost space at a seam, a sentence-initial word lowercased along with the
 * common nouns around it, a clause quietly rewritten. All of those are obvious on a read and
 * none of them are visible while looking at one word's tool result.
 *
 * The checklist is closed on purpose. An open "review your work" invites more changes, and
 * this model has been measured changing correct text on two runs in three; the wording leans
 * on confirming, and names the only four things worth changing at this point.
 */
export default function buildReview(input: string, result: Result): string {
	return [
		'Your result arrived and nothing is wrong with it. This is not a rejection: it is the last step, and it happens for every check.',
		'Here is your answer joined the way the reader will see it.',
		'',
		`ORIGINAL: ${input}`,
		`YOUR RESULT: ${joinParts(result)}`,
		'',
		'Read the result as text now, not as parts, and check these four things only:',
		'1. Every sentence of the original is still there, and none was added.',
		'2. The spacing at each seam is the spacing the original had: no full stop stuck to the next word, no doubled space.',
		'3. A word that begins a sentence still begins with a capital, even where you lowercased the same word elsewhere.',
		'4. Nothing changed that was not wrong. A difference you cannot name the rule for is a difference to undo.',
		'',
		'Sending the same parts back unchanged is the expected outcome, and is what you should do unless one of the four points above names the problem. Do not look for new corrections here.'
	].join('\n');
}
