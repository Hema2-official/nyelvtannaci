// optimizations to make the text more readable for LLMs:
const linguisticOptimizations = {
	'L. még:': 'Lásd még:'
};

export default function optimizeForLLM(text: string) {
	for (const [key, value] of Object.entries(linguisticOptimizations))
		text = text.replace(key, value);
	return text;
}
