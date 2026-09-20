import type { ClientInit } from '@sveltejs/kit';
import { installAbortSignalAny } from '$lib/utils/abortSignalAny';

export const init: ClientInit = () => {
	installAbortSignalAny();
};
