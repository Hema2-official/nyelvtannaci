import type { HTMLElement } from 'node-html-parser';

import kulonVagyEgybe from './tools/kulonVagyEgybe';
import helyesEIgy from './tools/helyesEIgy';
import elvalasztas from './tools/elvalasztas';

// general tool type
export type Tool<T> = {
	url: string;
	parse: (doc: HTMLElement) => T;
};

export const tools = {
	kulonVagyEgybe,
	helyesEIgy,
	elvalasztas
};

export type ToolName = keyof typeof tools;
export type ToolResult = Awaited<ReturnType<(typeof tools)[ToolName]['parse']>>;
