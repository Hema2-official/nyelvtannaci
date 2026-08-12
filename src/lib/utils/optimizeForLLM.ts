/**
 * The MTA pages are written for someone who can see them. A tip line may be a bare gloss in
 * quotes, or lean on an abbreviation that the layout around it makes obvious. The model reads
 * these fragments on their own, so make the shorthand explicit before it does.
 *
 * Prose only. Never run this over a spelling the site suggests: that text is the answer, and
 * it has to reach the model exactly as the site wrote it.
 */
const rewrites: { pattern: RegExp; replacement: string }[] = [
	// "L. még: fáradtság"
	{ pattern: /\bL\. még:/g, replacement: 'Lásd még:' },
	// "Pl.: A favágó fáradságos munkával megkeresett bérével tért haza."
	{ pattern: /\bPl\.:/g, replacement: 'Például:' },
	// A tip that is nothing but a gloss in U+2019 quotes is the word's meaning, and nothing
	// on the line says so: "’fáradozás’"
	{ pattern: /^\s*’([^’]+)’\s*$/, replacement: 'Jelentése: ’$1’' }
];

export default function optimizeForLLM(text: string) {
	for (const { pattern, replacement } of rewrites) text = text.replace(pattern, replacement);
	return text;
}
