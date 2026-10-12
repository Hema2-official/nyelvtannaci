import type { z, ZodType } from 'zod';

/**
 * What can follow the closing quote of a JSON string: the end of the text, a closing bracket,
 * or a comma or colon with the next value right after it.
 */
const STRING_END = /\s*(?:$|[}\]]|[,:]\s*(?:["{[\d-]|(?:true|false|null)\s*[,}\]]))/y;

export function escapeStrayQuotes(json: string): string {
	let repaired = '';
	let inString = false;
	for (let i = 0; i < json.length; i++) {
		const char = json[i];
		if (inString && char === '\\') {
			// copied whole, so an escaped quote is never mistaken for a bare one
			repaired += json.slice(i, i + 2);
			i++;
			continue;
		}
		if (char === '"') {
			if (!inString) {
				inString = true;
			} else {
				STRING_END.lastIndex = i + 1;
				if (!STRING_END.test(json)) {
					repaired += '\\"';
					continue;
				}
				inString = false;
			}
		}
		repaired += char;
	}
	return repaired;
}

function parseLenient(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch (error: unknown) {
		const repaired = escapeStrayQuotes(text);
		if (repaired === text) throw error;
		try {
			return JSON.parse(repaired);
		} catch {
			throw error;
		}
	}
}

/** What zod calls the shapes a model may send as a string of JSON instead. */
const CONTAINERS = new Set(['array', 'object', 'record', 'tuple']);

/** Each round decodes one level of nesting. Two was the highest nesting seen so far. */
const MAX_DECODE_ROUNDS = 5;

function valueAt(root: unknown, path: PropertyKey[]): unknown {
	return path.reduce<unknown>((node, key) => (node as Record<PropertyKey, unknown>)?.[key], root);
}

/** Parses a model's JSON and validates it against `schema`. */
export default function parseModelJson<T extends ZodType>(schema: T, text: string): z.infer<T> {
	let value = parseLenient(text);

	for (let round = 0; ; round++) {
		const parsed = schema.safeParse(value);
		if (parsed.success) return parsed.data;

		let decoded = false;
		for (const issue of round < MAX_DECODE_ROUNDS ? parsed.error.issues : []) {
			if (issue.code !== 'invalid_type' || !CONTAINERS.has(issue.expected)) continue;

			const encoded = valueAt(value, issue.path);
			if (typeof encoded !== 'string') continue;

			let inner: unknown;
			try {
				inner = parseLenient(encoded);
			} catch {
				continue;
			}
			if (typeof inner !== 'object' || inner === null) continue;

			if (issue.path.length === 0) value = inner;
			else
				(valueAt(value, issue.path.slice(0, -1)) as Record<PropertyKey, unknown>)[
					issue.path[issue.path.length - 1]
				] = inner;
			decoded = true;
		}

		if (!decoded) throw parsed.error;
	}
}
