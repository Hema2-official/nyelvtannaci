import { elvalasztasFunction } from '$lib/scraper-new/elvalasztas';
import { helyesEIgyFunction } from '$lib/scraper-new/helyesEIgy';
import { kulonVagyEgybeFunction } from '$lib/scraper-new/kulonVagyEgybe';
import { z } from 'zod';

export const availableFunctions = [kulonVagyEgybeFunction, helyesEIgyFunction, elvalasztasFunction];

const resultPartType = z.object({
	text: z.string(),
	type: z
		.enum(['original', 'corrected', 'added', 'removed'])
		.describe(
			"Original, if this part hasn't been modified and is a straight quote from the input. Corrected, added, and removed are self-explanatory."
		),
	explanation: z
		.string()
		.describe(
			'Explanation for the actions taken to correct this part (can be empty). If the part is original, this should be empty.'
		),
	references: z.array(z.string()).describe('Corresponding references, if any')
});

export const resultType = z.object({
	error: z.string().describe('Error message if correction failed, empty otherwise'),
	resultParts: z
		.array(resultPartType)
		.describe(
			'The corrected text in split form, with the immediately joined form of these parts being the corrected text in its entirety.'
		)
});

export type Result = z.infer<typeof resultType>;

export const developerPrompt = [
	[
		'Task',
		`Check and correct Hungarian spelling and grammar in the user input, using the MTA tools and your own knowledge.
		 You are not talking to the user: the result is the only thing they ever see.`
	],
	[
		'Tools',
		`- kulon_vagy_egybe: whether the given words (separated by spaces) go separately, together or hyphenated.
		 - helyes-e_igy: whether a word is spelled correctly, with suggested spellings and tips.
		 - elvalasztas: correct hyphenation of a word or words.`
	],
	[
		'Coverage',
		`The tools only answer about what you send them, so decide what is worth sending. Typically:
		 - neighbouring words that may form a compound ("testre szabás", "matek verseny");
		 - the members of a compound on their own ("ablakpárkány" -> "ablak", "párkány");
		 - words stripped of their affixes ("előadásokban" -> "előadás");
		 - every member of a coordinated list, expanded to its full form ("színanyag- és vitamintartalom" -> "színanyagtartalom", "vitamintartalom").
		 Text that looks correct is worth checking too, compounds and lists especially. Batch what you can, and query again when a result changes what you suspect.`
	],
	[
		'Judgement',
		`The tools are a strong signal, not an oracle, and you are responsible for the final answer.
		 - helyes-e_igy flags words that are perfectly correct (e.g. "parabén"); an unknown word is not automatically an error.
		 - kulon_vagy_egybe answers the question it was asked, which may not be the intended meaning. For "mesterséges színezék mentes" it suggests "mesterséges-színezékmentes" (mesterségesen színezékmentes), while the intended meaning is almost always "mesterségesszínezék-mentes" (mentes a mesterséges színezéktől).
		 - When tool output and meaning disagree, follow the meaning and say so in the explanation.`
	],
	[
		'Result',
		`Split the corrected text into parts so that concatenating them, in order and without separators, gives the corrected text in full.
		 Mark each part as original, corrected, added or removed, and leave the explanation empty for original parts.
		 Quote explanations and references from the tools in Hungarian, verbatim. Never invent references, and never translate them.
		 Fill the error field only if the correction could not be produced at all; otherwise leave it empty.`
	],
	[
		'Examples',
		`Input: "Mesterséges színezék, parabén és szilikon mentes!"
		 Tools: kulon_vagy_egybe on "mesterséges színezék mentes" (see above), "parabén mentes" -> "parabénmentes", "szilikon mentes" -> "szilikonmentes"
		 Parts: "Mesterségesszínezék-" (corrected), ", " (original), "parabén-" (corrected), " és " (original), "szilikonmentes" (corrected), "!" (original)

		 Input: "testre szabás"
		 Tools: kulon_vagy_egybe on "testre szabás" -> "testreszabás"
		 Parts: "testreszabás" (corrected)

		 Input: "testreszabott"
		 Tools: kulon_vagy_egybe on "testre szabott" -> "testre szabott"
		 Parts: "testre szabott" (corrected)

		 Input: "Részt veszek informatikai, irodalom és matekversenyeken"
		 Tools: kulon_vagy_egybe on "informatikai verseny" -> "informatikai verseny", "irodalom verseny" -> "irodalomverseny", "matek verseny" -> "matekverseny"
		 Parts: "Részt veszek informatikai, " (original), "irodalom-" (corrected), " és matekversenyeken" (original), "." (added)

		 Input: "tely"
		 Tools: helyes-e_igy on "tely" -> "tej"
		 Parts: "tej" (corrected)`
	]
]
	.map(([header, content]) => {
		const lines = content.split('\n').map((line) => line.trim());
		return `# ${header.trim()}\n${lines.join('\n')}`;
	})
	.join('\n\n');
