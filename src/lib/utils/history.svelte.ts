import Dexie, { liveQuery, type Observable, type Table } from 'dexie';
import { fromStore, type Readable } from 'svelte/store';
import type { SuccessfulResult } from '$lib/llm/promptConfig';
import type { IntermediateSummary } from '$lib/llm/toolSummary.type';

export type HistoryEntry = {
	id?: number;
	query: string;
	result: SuccessfulResult;
	summaries: IntermediateSummary[];
	createdAt: Date;
};

/** Adapts a Dexie/RxJS Observable ({ unsubscribe }) to a Svelte Readable (() => void). */
function toReadable<T>(observable: Observable<T>): Readable<T> {
	return {
		subscribe(run) {
			const sub = observable.subscribe({
				next: (val) => run(val),
				error: (err) => console.error(err)
			});
			return () => sub.unsubscribe();
		}
	};
}

export class HistoryDatabase extends Dexie {
	history!: Table<HistoryEntry, number>;

	constructor() {
		super('HistoryDatabase');
		this.version(1).stores({
			history: '++id, query, createdAt'
		});
	}

	async addEntry(query: string, result: SuccessfulResult, summaries: IntermediateSummary[]) {
		return await this.history.add({
			query,
			result,
			summaries,
			createdAt: new Date()
		});
	}

	getAll() {
		return fromStore(
			toReadable(liveQuery(() => this.history.orderBy('createdAt').reverse().toArray()))
		);
	}

	search(term: string | (() => string)) {
		return fromStore(
			toReadable(
				liveQuery(() => {
					const queryTerm = (typeof term === 'function' ? term() : term).toLowerCase();
					return this.history
						.filter((entry) => entry.query.toLowerCase().includes(queryTerm))
						.toArray();
				})
			)
		);
	}

	async deleteEntry(id: number) {
		return await this.history.delete(id);
	}
}

export const historyDb = new HistoryDatabase();
