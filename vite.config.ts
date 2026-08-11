import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: {
		port: 5175,
		host: true
	},
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node',
		testTimeout: 30_000,
		hookTimeout: 60_000
	}
});
