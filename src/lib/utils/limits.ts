import { env } from '$env/dynamic/public';

const DEFAULT_MAX_INPUT = 5000;

export const maxInputLength = (() => {
	const value = Number(env.PUBLIC_MAX_INPUT_LENGTH);
	return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_INPUT;
})();
