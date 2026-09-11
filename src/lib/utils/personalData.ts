export type PersonalDataKind =
	| 'apiKey'
	| 'credential'
	| 'jwt'
	| 'privateKey'
	| 'email'
	| 'phone'
	| 'address'
	| 'bankAccount'
	| 'iban'
	| 'cardNumber'
	| 'taxNumber'
	| 'taj'
	| 'idCard';

export type PersonalDataMatch = {
	kind: PersonalDataKind;
	/** The matched text exactly as it stands in the input, so the user can find it again. */
	text: string;
	/** Where it starts, so the findings can be listed in reading order. */
	index: number;
};

export const personalDataLabels: Record<PersonalDataKind, string> = {
	apiKey: 'API-kulcs',
	credential: 'Jelszó vagy titok',
	jwt: 'Hozzáférési token',
	privateKey: 'Titkos kulcs',
	email: 'E-mail cím',
	phone: 'Telefonszám',
	address: 'Cím',
	bankAccount: 'Bankszámlaszám',
	iban: 'IBAN',
	cardNumber: 'Bankkártyaszám',
	taxNumber: 'Adószám',
	taj: 'TAJ-szám',
	idCard: 'Személyi igazolvány száma'
};

/**
 * Longer forms first: the alternation is ordered, so `út` placed before `útja` would match the
 * stem and leave `ja` behind, and the house number after it would then never line up.
 */
const STREET_TYPE = String.raw`(?:utcája|utcai|utca|u\.|útja|útján|úton|útra|út|tere|terén|térre|tér|körútja|körúton|körút|krt\.|sétány|köz|sor|rakpart|fasor|dűlő|liget|park|udvar|lakótelep|ltp\.)`;

/**
 * `1052 Budapest,` if it is there, then one to three name words of which the first is
 * capitalised, then the street type, then a house number. The number is what keeps this from
 * firing on ordinary prose: `a hosszú út` is a sentence, `a Hosszú út 5.` is an address.
 */
const ADDRESS = new RegExp(
	String.raw`(?:\b[1-9]\d{3}\s+\p{Lu}\p{L}+(?:[\s-]\p{Lu}\p{L}+)*,?\s+)?` +
		String.raw`\p{Lu}\p{L}+(?:[\s-]\p{L}+){0,2}\s+` +
		STREET_TYPE +
		String.raw`\s*\d+[./]?(?:\s*[/-]?\s*[A-Za-z]\b)?`,
	'gu'
);

type Detector = {
	kind: PersonalDataKind;
	pattern: RegExp;
	/** A second opinion for patterns loose enough to catch ordinary numbers. */
	verify?: (match: string) => boolean;
};

const detectors: Detector[] = [
	// A PEM block's header is enough - the key material after it needs no matching.
	{ kind: 'privateKey', pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g },

	// Vendor-prefixed credentials.
	{
		kind: 'apiKey',
		pattern:
			/\b(?:sk-ant-api\d{2}-[\w-]{20,}|sk-or-v1-[a-f0-9]{40,}|sk-proj-[\w-]{20,}|sk-[A-Za-z0-9]{20,}|AIza[\w-]{35}|A(?:KIA|SIA)[A-Z0-9]{16}|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,}|xox[baprs]-[A-Za-z0-9-]{10,}|[sprk]k_(?:live|test)_[A-Za-z0-9]{20,}|SG\.[\w-]{20,}\.[\w-]{40,}|npm_[A-Za-z0-9]{36}|hf_[A-Za-z0-9]{34}|glpat-[\w-]{20})/g
	},

	// header.payload.signature - a JWT always opens with the base64 of `{"`.
	{ kind: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },

	// `jelszó: ...`, `api_key=...`. The keyword carries the meaning, so the value after it need
	// not look like anything in particular - but it must be eight characters with no space in
	// them, which is what keeps `A jelszó: nem tudom` out. Bare `token` is deliberately absent:
	// this is a grammar tool, and `token` is a word its users write about.
	{
		kind: 'credential',
		pattern:
			/\b(?:jelszó|jelszava|jelszavam|password|passwd|pwd|secret|client[_ -]?secret|api[_ -]?(?:key|kulcs)|access[_ -]?(?:key|token)|auth[_ -]?token|private[_ -]?key)\s*[:=]\s*["']?([^\s"']{8,})/giu
	},
	{ kind: 'credential', pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g },

	{ kind: 'email', pattern: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu },

	// HU42 1177 3016 1111 1018 0000 0000 - 15 to 34 characters once the spaces are gone.
	{ kind: 'iban', pattern: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}\b/gu },

	// 12345678-1-42
	{ kind: 'taxNumber', pattern: /\b\d{8}-\d-\d{2}\b/gu },

	// 11773016-11111018, with the third block for accounts that carry one.
	{ kind: 'bankAccount', pattern: /\b\d{8}-\d{8}(?:-\d{8})?\b/gu },

	// 1234 5678 9012 3456, and the 4-6-5 Amex grouping. Luhn does the deciding.
	{
		kind: 'cardNumber',
		pattern: /\b(?:\d{4}[\s-]){3}\d{4}\b|\b\d{4}[\s-]\d{6}[\s-]\d{5}\b/gu,
		verify: (match) => luhn(match.replace(/\D/g, ''))
	},

	// +36 30 123 4567, 0036..., 06 1 234 5678, (06 30) 123 4567
	{
		kind: 'phone',
		pattern:
			/(?<![\d\p{L}])(?:\+36|0036|06)[\s\-/.()]{0,3}\(?\d{1,2}\)?[\s\-/.()]{0,3}\d{3}[\s\-/.()]{0,3}\d{3,4}(?!\d)/gu
	},
	// 30/123-4567 - a mobile prefix written without the trunk code. The separator is required,
	// so a bare seven-digit run in a sentence is not a phone number.
	{ kind: 'phone', pattern: /(?<![\d\p{L}])(?:20|30|31|50|70)[\s\-/]\d{3}[\s\-/]?\d{4}(?!\d)/gu },
	// Anything else that opens with a country code.
	{
		kind: 'phone',
		pattern: /(?<![\d\p{L}])\+\d{1,3}[\s\-/.()]{0,2}(?:\d[\s\-/.()]{0,2}){6,13}\d(?!\d)/gu
	},

	// 123 456 789, but not `100 000 000 forint` - a price is grouped the same way.
	{
		kind: 'taj',
		pattern:
			/(?<![\d\p{L}])\d{3}[\s-]\d{3}[\s-]\d{3}(?!\d)(?!\s*(?:[Ff]orint|[Ff][Tt]|EUR|[Ee]uró|USD|[Dd]ollár)\b)/gu
	},

	// 123456AB
	{ kind: 'idCard', pattern: /\b\d{6}[A-Z]{2}\b/gu },

	{ kind: 'address', pattern: ADDRESS }
];

/** The check every card number on a form has passed since 1960. */
function luhn(digits: string) {
	let sum = 0;
	let double = false;
	for (let i = digits.length - 1; i >= 0; i--) {
		let digit = digits.charCodeAt(i) - 48;
		if (double) {
			digit *= 2;
			if (digit > 9) digit -= 9;
		}
		sum += digit;
		double = !double;
	}
	return sum % 10 === 0;
}

/**
 * Every shape the detectors recognise, in reading order, with overlaps resolved in favour of
 * the earlier - more specific - detector. A card number is reported once as a card number, not
 * three times as a card number and two TAJ numbers.
 */
export function findPersonalData(text: string): PersonalDataMatch[] {
	const found: PersonalDataMatch[] = [];
	const taken: { start: number; end: number }[] = [];

	for (const { kind, pattern, verify } of detectors) {
		for (const match of text.matchAll(pattern)) {
			const start = match.index;
			const end = start + match[0].length;
			if (taken.some((span) => start < span.end && end > span.start)) continue;
			if (verify && !verify(match[0])) continue;

			taken.push({ start, end });
			found.push({ kind, text: match[0].trim(), index: start });
		}
	}

	return found.sort((a, b) => a.index - b.index);
}

/** How many of each kind were found (for analytics) */
export function countPersonalData(matches: PersonalDataMatch[]) {
	const counts: Partial<Record<PersonalDataKind, number>> = {};
	for (const { kind } of matches) counts[kind] = (counts[kind] ?? 0) + 1;
	return counts;
}

function forDisplay(text: string) {
	return text.length > 48 ? text.slice(0, 48) + '…' : text;
}

/**
 * The findings as the dialog lists them: one row per kind, each carrying the distinct snippets
 * that produced it. Repeating the same email address four times says nothing new.
 */
export function groupPersonalData(matches: PersonalDataMatch[]) {
	const groups = new Map<PersonalDataKind, string[]>();

	for (const { kind, text } of matches) {
		const texts = groups.get(kind) ?? [];
		if (!texts.includes(text)) texts.push(text);
		groups.set(kind, texts);
	}

	return [...groups].map(([kind, texts]) => ({
		kind,
		label: personalDataLabels[kind],
		texts: texts.map(forDisplay)
	}));
}
