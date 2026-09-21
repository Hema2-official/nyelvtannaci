import type { LucideIcon } from '@lucide/svelte';
import type { DocsSectionId, ReaderType } from './docsVocabulary';
import {
	CogIcon,
	ContainerIcon,
	InfoIcon,
	KeyboardIcon,
	ShieldIcon,
	TriangleAlertIcon
} from '@lucide/svelte';

export type DocsSection = {
	/** key and hash for URL navigation */
	id: DocsSectionId;
	label: string;
	Icon: LucideIcon;
};

export type DocsGroup = {
	id: string;
	label: string;
	sections: readonly DocsSection[];
};

export const docsGroups = [
	{
		id: 'tudnivalok',
		label: 'Tudnivalók',
		sections: [
			{ id: 'mi-ez', label: 'Mi ez?', Icon: InfoIcon },
			{ id: 'hasznalat', label: 'Használat', Icon: KeyboardIcon },
			{ id: 'korlatok', label: 'Korlátok', Icon: TriangleAlertIcon },
			{ id: 'adatkezeles', label: 'Adatkezelés', Icon: ShieldIcon }
		]
	},
	{
		id: 'technikai-reszletek',
		label: 'Technikai részletek',
		sections: [
			{ id: 'ellenorzesi-folyamat', label: 'Ellenőrzési folyamat', Icon: CogIcon },
			{ id: 'kornyezeti-adatok', label: 'Környezeti adatok', Icon: ContainerIcon }
		]
	}
] as const satisfies readonly DocsGroup[];

export const docsSections = docsGroups.flatMap<DocsSection>((group) => group.sections);

export type DocsGroupId = (typeof docsGroups)[number]['id'];
export type { DocsSectionId } from './docsVocabulary';

export const readerOptions: { value: ReaderType; label: string }[] = [
	{ value: 'normal', label: 'Mindenkinek' },
	{ value: 'technical', label: 'Hozzáértőknek' }
];
