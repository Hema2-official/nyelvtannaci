import type { SuccessfulResult } from '$lib/llm/promptConfig';
import type { IntermediateSummary } from '$lib/llm/toolSummary.type';
import { historyDb, type HistoryEntry } from '$lib/utils/history.svelte';

class ViewState {
	currentInput = $state('');
	showAnalysis = $state(false);
	intermediateSummaries: IntermediateSummary[] = $state([]);
	currentResult: SuccessfulResult | null = $state(null);

	appendSummaries(summaries: IntermediateSummary[]) {
		this.intermediateSummaries = [...this.intermediateSummaries, ...summaries];
	}

	async openHistory(id: HistoryEntry['id']) {
		if (id == null) return;
		const entry = await historyDb.history.get(id);
		if (entry == null) return;

		this.currentInput = entry.query;
		this.showAnalysis = true;
		this.intermediateSummaries = entry.summaries;
		this.currentResult = entry.result;
	}

	clearSession() {
		this.intermediateSummaries = [];
		this.currentResult = null;
	}

	resetSession() {
		this.currentInput = '';
		this.showAnalysis = false;
		this.clearSession();
	}
}

export const viewState = new ViewState();
