import type { Result } from '../llm/promptConfig';
import type { Chunk } from './splitSentences';

export function originalPart(text: string): Result['resultParts'][number] {
	return { text, type: 'original', explanation: '', references: [] };
}

type Part = Result['resultParts'][number];
const isPlainOriginal = (p: Part) => p.type === 'original' && !p.explanation;

/** Consecutive untouched parts read as one; the seams between chunks should not show. */
export function mergeAdjacentOriginals(parts: Part[]) {
	return parts.reduce<Part[]>((merged, part) => {
		const last = merged.at(-1);

		if (last && isPlainOriginal(last) && isPlainOriginal(part)) {
			last.text += part.text;
		} else {
			merged.push(part);
		}

		return merged;
	}, []);
}

/** The corrected text of one chunk, as the reader sees it. */
function correctedChunk(chunk: Chunk, result: Result | undefined) {
	if (!result) return chunk.text;
	return result.resultParts
		.filter((part) => part.type !== 'removed')
		.map((part) => part.text)
		.join('');
}

export default function mergeChunkResults(chunks: Chunk[], results: Result[]): Result {
	const parts = chunks.flatMap((chunk, index) => [
		...(chunk.leading ? [originalPart(chunk.leading)] : []),
		...(results[index]?.resultParts ?? [originalPart(chunk.text)]),
		...(chunk.trailing ? [originalPart(chunk.trailing)] : [])
	]);

	// An alternative is a whole corrected text, but a chunk only ever saw its own sentence.
	// Put each one back into the surrounding text, or it reads as an unrelated fragment.
	const alternatives = chunks.flatMap((chunk, index) =>
		(results[index]?.alternatives ?? []).map((alternative) => ({
			meaning: alternative.meaning,
			text: chunks
				.map((other, otherIndex) =>
					otherIndex === index
						? other.leading + alternative.text + other.trailing
						: other.leading + correctedChunk(other, results[otherIndex]) + other.trailing
				)
				.join('')
		}))
	);

	return {
		// null, not '', so that "no error" is one value everywhere rather than two
		error:
			results
				.map((result) => result?.error)
				.filter(Boolean)
				.join('; ') || null,
		resultParts: mergeAdjacentOriginals(parts),
		alternatives
	};
}
