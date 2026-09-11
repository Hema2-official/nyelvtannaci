import { describe, expect, it } from 'vitest';
import { findPersonalData, groupPersonalData } from '$lib/utils/personalData';

/** The kinds found in a text, in reading order. */
const kinds = (text: string) => findPersonalData(text).map((m) => m.kind);
/** The snippets found, in reading order. */
const texts = (text: string) => findPersonalData(text).map((m) => m.text);

describe('findPersonalData', () => {
	it('finds an email address', () => {
		expect(kinds('Írj a kovacs.janos@example.com címre!')).toEqual(['email']);
		expect(texts('Írj a kovacs.janos@example.com címre!')).toEqual(['kovacs.janos@example.com']);
	});

	it('finds an email address with accents in it', () => {
		expect(texts('Elérhetőség: kovács.jános@példa.hu')).toEqual(['kovács.jános@példa.hu']);
	});

	it('finds Hungarian phone numbers however they are written', () => {
		for (const phone of [
			'+36 30 123 4567',
			'+36301234567',
			'+36-30-123-4567',
			'0036 30 123 4567',
			'06 30 123 4567',
			'06-1-234-5678',
			'06 1 234 5678',
			'(06 30) 123 4567',
			'30/123-4567'
		]) {
			expect(kinds(`Hívj fel: ${phone}, aztán beszélünk.`), phone).toEqual(['phone']);
		}
	});

	it('finds a foreign number that opens with a country code', () => {
		expect(kinds('A bécsi szám: +43 1 234 5678.')).toEqual(['phone']);
	});

	it('does not call an ordinary number a phone number', () => {
		// a bare 36 is a number, and a year is not a trunk prefix
		expect(kinds('A 36 fokos melegben 2006 óta nem járt itt.')).toEqual([]);
		expect(kinds('Az ár 1 234 567 forint volt.')).toEqual([]);
	});

	it('finds an address with a house number', () => {
		expect(texts('A boltot a Kossuth utca 5. szám alatt találod.')).toEqual(['Kossuth utca 5.']);
		expect(texts('Lakcím: 1052 Budapest, Deák Ferenc tér 3.')).toEqual([
			'1052 Budapest, Deák Ferenc tér 3.'
		]);
		expect(kinds('Ide költöztünk: Váci út 12/A')).toEqual(['address']);
	});

	it('leaves a street word alone when it is just a sentence', () => {
		expect(kinds('Hosszú út vezetett odáig, és fáradság volt megtenni.')).toEqual([]);
		expect(kinds('A tér közepén állt, és az utca felé nézett.')).toEqual([]);
		// the capital here is the sentence's own, not a street name, and the 5 is a distance
		expect(kinds('A hosszú úton 5 kilométert gyalogoltunk.')).toEqual([]);
	});

	it('starts an address at the name, not at the sentence capital', () => {
		expect(texts('A Nagy Sándor tér 2. alatt lakik.')).toEqual(['Nagy Sándor tér 2.']);
	});

	it('does not call a price a TAJ number', () => {
		// a price carries the same 3-3-3 grouping
		expect(kinds('Az ár 100 000 000 forint volt.')).toEqual([]);
		expect(kinds('A lakás 120 000 000 Ft-ba került.')).toEqual([]);
		// but the same digits without the currency after them still count
		expect(kinds('A TAJ-szám 100 000 000 lett.')).toEqual(['taj']);
	});

	it('finds account numbers, tax numbers and IBANs', () => {
		expect(kinds('Utald ide: 11773016-11111018')).toEqual(['bankAccount']);
		expect(kinds('A hosszú számla: 11773016-11111018-00000000')).toEqual(['bankAccount']);
		expect(kinds('Adószám: 12345678-1-42')).toEqual(['taxNumber']);
		expect(kinds('IBAN: HU42 1177 3016 1111 1018 0000 0000')).toEqual(['iban']);
	});

	it('finds a card number only when it could be one', () => {
		// 4111 1111 1111 1111 is the canonical test number, and it passes Luhn
		expect(kinds('A kártyaszám 4111 1111 1111 1111 volt.')).toEqual(['cardNumber']);
		// the same shape with a digit changed is not a card number
		expect(kinds('A rendelés száma 4111 1111 1111 1112 volt.')).not.toContain('cardNumber');
	});

	it('reports a card number once, not as three TAJ numbers', () => {
		expect(kinds('4111 1111 1111 1111')).toEqual(['cardNumber']);
	});

	it('finds a TAJ number and an ID card number', () => {
		expect(kinds('A TAJ-számom 123 456 789, ne add tovább.')).toEqual(['taj']);
		expect(kinds('Az igazolvány száma 123456AB.')).toEqual(['idCard']);
	});

	it('finds nothing in a text that has nothing to find', () => {
		expect(kinds('Ez a doboz kisebb, mint a másik, és a munkaerő-piaci helyzet is jobb.')).toEqual(
			[]
		);
		expect(kinds('')).toEqual([]);
	});

	it('reports every finding in reading order', () => {
		const text = 'Kovács János, 06 30 123 4567, kovacs@example.com, Kossuth utca 5.';
		expect(kinds(text)).toEqual(['phone', 'email', 'address']);
	});
});

describe('groupPersonalData', () => {
	it('collapses the same finding repeated', () => {
		const text = 'Írj a kovacs@example.com címre, vagy ide: kovacs@example.com.';
		expect(groupPersonalData(findPersonalData(text))).toEqual([
			{ kind: 'email', label: 'E-mail cím', texts: ['kovacs@example.com'] }
		]);
	});

	it('keeps distinct findings of one kind apart', () => {
		const text = 'kovacs@example.com és nagy@example.com';
		const [group] = groupPersonalData(findPersonalData(text));
		expect(group.texts).toEqual(['kovacs@example.com', 'nagy@example.com']);
	});
});

describe('credentials', () => {
	it('finds vendor-prefixed API keys', () => {
		for (const key of [
			'sk-ant-api03-' + 'x'.repeat(40),
			'sk-or-v1-' + 'a1b2c3d4e5'.repeat(4),
			'sk-proj-' + 'X'.repeat(40),
			'sk-' + 'A1b2C3d4E5f6G7h8I9j0',
			'AIza' + 'B'.repeat(35),
			'AKIAIOSFODNN7EXAMPLE',
			'ghp_' + 'z'.repeat(36),
			'xoxb-123456789012-abcdefghijkl',
			'sk_live_' + 'Q'.repeat(24),
			'npm_' + 'n'.repeat(36),
			'hf_' + 'h'.repeat(34)
		]) {
			expect(kinds(`A kulcs: ${key} - ezt ne oszd meg.`), key).toContain('apiKey');
		}
	});

	it('finds a JWT and a PEM header', () => {
		const jwt =
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K';
		expect(kinds(`Authorization fejléc: ${jwt}`)).toContain('jwt');
		expect(kinds('-----BEGIN RSA PRIVATE KEY-----')).toEqual(['privateKey']);
		expect(kinds('-----BEGIN OPENSSH PRIVATE KEY-----')).toEqual(['privateKey']);
	});

	it('finds a secret behind its keyword', () => {
		expect(kinds('jelszó: Titkos123!')).toEqual(['credential']);
		expect(kinds('A jelszavam: kutyamacska99')).toEqual(['credential']);
		expect(kinds('api_key=abcdefgh12345678')).toEqual(['credential']);
		expect(kinds('Authorization: Bearer ' + 'q'.repeat(30))).toEqual(['credential']);
	});

	it('reports a prefixed key once, not also as the keyword around it', () => {
		expect(kinds('api_key=sk-A1b2C3d4E5f6G7h8I9j0')).toEqual(['apiKey']);
	});

	it('leaves the words themselves alone', () => {
		// this is a grammar tool: its users write sentences about passwords and tokens
		expect(kinds('A jelszó legyen legalább nyolc karakter hosszú.')).toEqual([]);
		expect(kinds('A jelszó: nem tudom.')).toEqual([]);
		expect(kinds('A token egy szövegegység a nyelvészetben.')).toEqual([]);
		expect(kinds('Az access key fogalmát a cikk nem magyarázza el.')).toEqual([]);
	});

	it('shortens a finding too long to show', () => {
		const jwt =
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K';
		const [group] = groupPersonalData(findPersonalData(jwt));
		expect(group.texts[0]).toHaveLength(49);
		expect(group.texts[0].endsWith('…')).toBe(true);
	});

	it('leaves a short finding whole', () => {
		const [group] = groupPersonalData(findPersonalData('Írj a kovacs@example.com címre.'));
		expect(group.texts).toEqual(['kovacs@example.com']);
	});
});
