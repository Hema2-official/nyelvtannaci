import axios from 'axios';
import https from 'node:https';
import { mtaResponseCache } from './responseCache';

const scraperAxios = axios.create({
	withCredentials: false,
	httpsAgent: new https.Agent({ rejectUnauthorized: false }),
	timeout: 10000 // 10 seconds timeout to prevent hanging
});

// Automatically retry transient errors (network, 5xx, timeout)
scraperAxios.interceptors.response.use(
	(response) => response,
	async (error) => {
		const config = error.config as any;

		if (!config) {
			return Promise.reject(error);
		}

		config.retryCount = config.retryCount ?? 0;
		const maxRetries = 5;
		const delayMs = 1000;

		const isNetworkOr5xxOrTimeout =
			!error.response ||
			(error.response.status >= 500 && error.response.status <= 599) ||
			error.code === 'ECONNABORTED';

		if (isNetworkOr5xxOrTimeout && config.retryCount < maxRetries) {
			config.retryCount += 1;
			console.warn(
				`MTA Scraper request failed (${error.message || error.code}). Retrying ${config.retryCount}/${maxRetries} in ${delayMs}ms...`
			);

			await new Promise((resolve) => setTimeout(resolve, delayMs));

			return scraperAxios(config);
		}

		return Promise.reject(error);
	}
);

export const getCached = (url: string) =>
	mtaResponseCache.fetch(url, async () => scraperAxios.get<string>(url).then((r) => r.data));

export default scraperAxios;
