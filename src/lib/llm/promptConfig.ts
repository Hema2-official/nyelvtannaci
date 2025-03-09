import scrapeMTA from '$lib/scraper/scrapeMTA';
import { z } from 'zod';

const kulonVagyEgybeParams = z.object({
	input: z.string().describe('Kérdéses szavak szóközzel elválasztva')
});

const helyesEIgyParams = z.object({
	input: z.string().describe('Ellenőrizendő szó')
});

const elvalasztasParams = z.object({
	input: z.string().describe('Elválasztandó szó vagy szavak')
});

export const availableFunctions = [
	{
		name: 'kulon_vagy_egybe',
		description:
			'A megadott szavak vizsgálata és javaslattétel arra, hogy hogyan lehet őket leírni (külön, egybe vagy kötőjellel).',
		parameters: kulonVagyEgybeParams,
		callback: async (args: z.infer<typeof kulonVagyEgybeParams>) =>
			await scrapeMTA('kulonVagyEgybe', args.input)
	},
	{
		name: 'helyes-e_igy',
		description:
			'Szóalak helyességének vizsgálata (pl. mássalhangzó-, magánhangzó-hosszúság, ly/j használata), helytelen alakhoz helyes alakok javaslata.',
		parameters: helyesEIgyParams,
		callback: async (args: z.infer<typeof helyesEIgyParams>) =>
			await scrapeMTA('helyesEIgy', args.input)
	},
	{
		name: 'elvalasztas',
		description: 'Szavak elválasztása a magyar helyesírás szabályai szerint.',
		parameters: elvalasztasParams,
		callback: async (args: z.infer<typeof elvalasztasParams>) =>
			await scrapeMTA('elvalasztas', args.input)
	}
];

const resultPart = z.object({
	text: z.string(),
	type: z
		.enum(['original', 'corrected', 'added', 'removed'])
		.describe('What this piece of text is'),
	explanation: z
		.string()
		.describe('Explanation for the actions taken to correct this part (can be empty)'),
	references: z.array(z.string()).describe('Corresponding references, if any')
});

export const resultType = z.object({
	error: z.string().describe('Error message if correction failed, empty otherwise'),
	resultParts: z.array(resultPart).describe('The corrected text represented in parts')
});

export type Result = z.infer<typeof resultType>;

export const developerPrompt = [
	[
		'Main goal',
		`Your task is to check and correct Hungarian grammar in the user input using external tools and your knowledge.`
	],
	[
		'Tools',
		`You can use the following tools to check and correct the text:
         - Külön vagy egybe: Check if the given words (separated by spaces) should be written separately, together or with a hyphen.
         - Helyes-e így: Check if the given word is spelled correctly, and receive suggestions for correct spellings or other useful tips.
         - Elválasztás: Get the correct hyphenation for the given word or words.
        `
	],
	[
		'Steps',
		`1. Extract as many parts of the text as you can to be checked with the tools. For example:
            - Disassemble compound words (e.g. "ablakpárkány" -> "ablak", "párkány")
            - Find separated words that could be in a compound. A good trick is to check if two words closely complement each other's meaning. Or just check neighboring words.
            - Remove affixes, check words that way too (e.g. "előadásokban" -> "előadás")
            - Expand lists of same-suffix compounds (e.g. "színanyag és vitamintartalom" -> "színanyag" + "tartalom", "vitamin" + "tartalom")
            - ... and more.
         2. Use the appropriate tools for checking parts of the text.
		 3. Rinse and repeat as you see fit.
		 4. Don't forget to asssemble the checked parts into the original form, put the words (if multiple) back together.
         5. Use the 'return_result' tool once you're satisfied with the result.
        `
	],
	[
		'Rules',
		`You should know about some aspects of this system:
         - You are not actually talking to the user, and the only communication to them is through the result.
         - You can use messages for thinking. Once you close a message, you will imediately be able to open a new one or use one or more tools.
         - You can use tools multiple times, in multiple messages too.
         - You should quote the references and explanations you got from the tools in the result. Don't make up your own, and only use Hungarian to quote. Don't translate it into English.
         - You can never be so sure about things, Hungarian grammar can be very tricky.
         - If you find something correct, ALWAYS question your own judgement. Especially with compound words and lists.
		 - The tools don't always give a correct answer. For example, "parabén" is a correct word, but helyes-e_igy will state otherwise.
		 - Another example for this is with kulon_vagy_egybe and "mesterséges színezék mentes". It will state that "mesterséges-színezékmentes" is correct, but it's often not what the user means: the correct form should be "mesterségesszínezék-mentes" (mentes a mesterséges színezéktől, nem pedig mesterségesen színezékmentes).
        `
	],
	[
		'Examples',
		`
		Input: "Mesterséges színezék, parabén és szilikon mentes!"
		Tool usage:
		- kulon_vagy_egybe: "mesterséges színezék mentes" -> "mesterséges-színezékmentes" (remember the aforementioned note about this example)
		- kulon_vagy_egybe: "parabén mentes" -> "parabénmentes"
		- kulon_vagy_egybe: "szilikon mentes" -> "szilikonmentes"
		Result: "Mesterségesszínezék-, parabén- és szilikonmentes!"

		Input: "testre szabás" or "testreszabás"
		Tool usage:
		- kulon_vagy_egybe: "testre szabás"
		Result: "testreszabás"

		Input: "testreszabott" or "testre szabott"
		Tool usage:
		- kulon_vagy_egybe: "testre szabott" -> "testre szabott"
		Result: "testre szabott"
		`
	]
]
	.map(([header, content]) => {
		const lines = content.split('\n').map((line) => line.trim());
		return `# ${header.trim()}\n${lines.join('\n')}`;
	})
	.join('\n');
