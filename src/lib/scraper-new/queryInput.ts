export const MAX_QUERY_LENGTH = 200;

/** Rejects empty, oversized, or malformed queries upfront to avoid sending unnecessary scraper requests. */
export default function cleanQuery(input: string): string {
	const query = input.trim();

	if (!query) throw new Error('Input is required');
	if (/\p{Cc}/u.test(query))
		throw new Error('Input must not contain control characters such as line breaks');
	if (query.length > MAX_QUERY_LENGTH)
		throw new Error(
			`Input is too long: a query is a word or a phrase, at most ${MAX_QUERY_LENGTH} characters`
		);

	return query;
}
