import OpenAI from 'openai';
import { env } from '$env/dynamic/private';

export type ProviderId = 'openai' | 'opencode-zen' | 'opencode-go' | 'openrouter' | 'custom';

type ProviderPreset = {
	/** Undefined means the caller has to supply LLM_BASE_URL. */
	baseURL?: string;
	/** Env vars that may hold the API key, in order of precedence. */
	apiKeyVars: string[];
	/** `developer` is an OpenAI-only role, every other gateway expects `system`. */
	supportsDeveloperRole: boolean;
	/** `strict: true` on tool definitions is an OpenAI structured-outputs feature. */
	supportsStrictTools: boolean;
	/** Whether `response_format: json_schema` constrains the final answer to the result schema. */
	supportsStructuredOutputs: boolean;
};

const presets: Record<ProviderId, ProviderPreset> = {
	openai: {
		baseURL: 'https://api.openai.com/v1',
		apiKeyVars: ['LLM_API_KEY', 'OPENAI_API_KEY'],
		supportsDeveloperRole: true,
		supportsStrictTools: true,
		supportsStructuredOutputs: true
	},
	// Zen (pay per token) and Go (subscription) are separate OpenCode services with
	// separate endpoints and model catalogues, but they share one API key.
	'opencode-zen': {
		baseURL: 'https://opencode.ai/zen/v1',
		apiKeyVars: ['LLM_API_KEY', 'OPENCODE_API_KEY', 'OPENCODE_ZEN_API_KEY'],
		supportsDeveloperRole: false,
		supportsStrictTools: false,
		supportsStructuredOutputs: false
	},
	'opencode-go': {
		baseURL: 'https://opencode.ai/zen/go/v1',
		apiKeyVars: ['LLM_API_KEY', 'OPENCODE_API_KEY', 'OPENCODE_GO_API_KEY'],
		supportsDeveloperRole: false,
		supportsStrictTools: false,
		supportsStructuredOutputs: false
	},
	openrouter: {
		baseURL: 'https://openrouter.ai/api/v1',
		apiKeyVars: ['LLM_API_KEY', 'OPENROUTER_API_KEY'],
		supportsDeveloperRole: false,
		supportsStrictTools: false,
		supportsStructuredOutputs: false
	},
	custom: {
		apiKeyVars: ['LLM_API_KEY', 'OPENAI_API_KEY'],
		supportsDeveloperRole: false,
		supportsStrictTools: false,
		supportsStructuredOutputs: false
	}
};

const providerAliases: Record<string, ProviderId> = {
	openai: 'openai',
	opencode: 'opencode-zen',
	'opencode-zen': 'opencode-zen',
	zen: 'opencode-zen',
	'opencode-go': 'opencode-go',
	go: 'opencode-go',
	openrouter: 'openrouter',
	custom: 'custom'
};

export type LLMProvider = {
	id: ProviderId;
	client: OpenAI;
	model: string;
	/** Role to use for the instruction message at the top of the conversation. */
	systemRole: 'developer' | 'system';
	/** Whether tool parameter schemas may use OpenAI strict mode. */
	strictTools: boolean;
	/** Whether the final answer can be constrained to the result schema. */
	structuredOutputs: boolean;
	/** Reasoning budget to request; undefined leaves the model on its own default. */
	reasoningEffort?: string;
	/** How many model responses a single session may consume. */
	maxTurns: number;
};

function read(name: string) {
	const value = env[name]?.trim();
	return value ? value : undefined;
}

function readBoolean(name: string) {
	const value = read(name)?.toLowerCase();
	if (value === undefined) return undefined;
	if (['1', 'true', 'yes', 'on'].includes(value)) return true;
	if (['0', 'false', 'no', 'off'].includes(value)) return false;
	throw new Error(`${name} must be a boolean ("true" or "false"), got "${value}"`);
}

function readPositiveInt(name: string, fallback: number) {
	const value = read(name);
	if (value === undefined) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0)
		throw new Error(`${name} must be a positive integer, got "${value}"`);
	return parsed;
}

function resolveProviderId(): ProviderId {
	const raw = read('LLM_PROVIDER')?.toLowerCase();

	// No explicit provider: a bare base URL means "some OpenAI-compatible endpoint",
	// otherwise fall back to the original OpenAI-only setup.
	if (!raw) return read('LLM_BASE_URL') ? 'custom' : 'openai';

	const id = providerAliases[raw];
	if (!id)
		throw new Error(
			`Unknown LLM_PROVIDER "${raw}". Expected one of: ${Object.keys(providerAliases).join(', ')}`
		);
	return id;
}

function resolveApiKey(id: ProviderId, preset: ProviderPreset) {
	for (const name of preset.apiKeyVars) {
		const value = read(name);
		if (value) return value;
	}
	throw new Error(
		`No API key found for provider "${id}". Set one of: ${preset.apiKeyVars.join(', ')}`
	);
}

function resolveHeaders(id: ProviderId) {
	const headers: Record<string, string> = {};

	// OpenRouter uses these for attribution on its public leaderboards. Both are optional.
	if (id === 'openrouter') {
		const appUrl = read('LLM_APP_URL');
		const appName = read('LLM_APP_NAME');
		if (appUrl) headers['HTTP-Referer'] = appUrl;
		if (appName) headers['X-Title'] = appName;
	}

	return headers;
}

function createProvider(): LLMProvider {
	const id = resolveProviderId();
	const preset = presets[id];

	const baseURL = read('LLM_BASE_URL') ?? preset.baseURL;
	if (!baseURL) throw new Error(`Provider "${id}" requires LLM_BASE_URL to be set`);

	const model = read('LLM_MODEL') ?? read('OPENAI_MODEL');
	if (!model) throw new Error(`No model configured for provider "${id}". Set LLM_MODEL`);

	const supportsDeveloperRole = readBoolean('LLM_DEVELOPER_ROLE') ?? preset.supportsDeveloperRole;
	const strictTools = readBoolean('LLM_STRICT_TOOLS') ?? preset.supportsStrictTools;
	const structuredOutputs =
		readBoolean('LLM_STRUCTURED_OUTPUTS') ?? preset.supportsStructuredOutputs;

	return {
		id,
		client: new OpenAI({
			apiKey: resolveApiKey(id, preset),
			baseURL,
			defaultHeaders: resolveHeaders(id)
		}),
		model,
		systemRole: supportsDeveloperRole ? 'developer' : 'system',
		strictTools,
		structuredOutputs,
		reasoningEffort: read('LLM_REASONING_EFFORT'),
		maxTurns: readPositiveInt('SESSION_MAX_TURNS', 25)
	};
}

let cached: LLMProvider | undefined;

/** Resolves the configured provider once per process. */
export default function getProvider(): LLMProvider {
	if (!cached) cached = createProvider();
	return cached;
}
