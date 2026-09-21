export const docsSectionIds = [
	'mi-ez',
	'hasznalat',
	'korlatok',
	'adatkezeles',
	'ellenorzesi-folyamat',
	'kornyezeti-adatok'
] as const;

export type DocsSectionId = (typeof docsSectionIds)[number];

const sections = new Set<string>(docsSectionIds);

export function isDocsSectionId(id: string | undefined): id is DocsSectionId {
	return id !== undefined && sections.has(id);
}

export const readerTypes = ['normal', 'technical'] as const;

export type ReaderType = (typeof readerTypes)[number];

export function isReaderType(value: string): value is ReaderType {
	return readerTypes.some((type) => type === value);
}
