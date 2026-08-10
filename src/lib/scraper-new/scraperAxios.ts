import axios from 'axios';
import https from 'node:https';

const scraperAxios = axios.create({
	withCredentials: false,
	httpsAgent: new https.Agent({ rejectUnauthorized: false }),
	timeout: 10000 // 10 seconds timeout to prevent hanging
});

// Response interceptor to automatically retry transient errors
scraperAxios.interceptors.response.use(
	(response) => response,
	async (error) => {
		const config = error.config as any;

		// If no config is present, we cannot retry
		if (!config) {
			return Promise.reject(error);
		}

		// Initialize or increment retry count
		config.retryCount = config.retryCount ?? 0;
		const maxRetries = 3;
		const delayMs = 1000;

		// Check if the error is transient: network error (no response), 5xx server error, or timeout
		const isNetworkOr5xxOrTimeout =
			!error.response ||
			(error.response.status >= 500 && error.response.status <= 599) ||
			error.code === 'ECONNABORTED';

		if (isNetworkOr5xxOrTimeout && config.retryCount < maxRetries) {
			config.retryCount += 1;
			console.warn(
				`MTA Scraper request failed (${error.message || error.code}). Retrying ${config.retryCount}/${maxRetries} in ${delayMs}ms...`
			);

			// Wait before retrying
			await new Promise((resolve) => setTimeout(resolve, delayMs));

			// Retry the request with the updated config
			return scraperAxios(config);
		}

		return Promise.reject(error);
	}
);

export default scraperAxios;
