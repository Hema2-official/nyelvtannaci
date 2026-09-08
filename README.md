# Codename Nyelvtannáci

## Running the project

```bash
pnpm install
pnpm dev
```

## LLM providers

The grammar checker talks to any OpenAI-compatible chat-completions endpoint. Copy
`.env.example` to `.env` and pick a provider with `LLM_PROVIDER`:

| `LLM_PROVIDER`         | Base URL                        | API key from                                              |
| ---------------------- | ------------------------------- | --------------------------------------------------------- |
| `openai`               | `https://api.openai.com/v1`     | `LLM_API_KEY` or `OPENAI_API_KEY`                         |
| `opencode-zen` (`zen`) | `https://opencode.ai/zen/v1`    | `LLM_API_KEY`, `OPENCODE_API_KEY`, `OPENCODE_ZEN_API_KEY` |
| `opencode-go` (`go`)   | `https://opencode.ai/zen/go/v1` | `LLM_API_KEY`, `OPENCODE_API_KEY`, `OPENCODE_GO_API_KEY`  |
| `openrouter`           | `https://openrouter.ai/api/v1`  | `LLM_API_KEY` or `OPENROUTER_API_KEY`                     |
| `custom`               | `LLM_BASE_URL` (required)       | `LLM_API_KEY` or `OPENAI_API_KEY`                         |

`opencode` is an alias for `opencode-zen`. Zen (pay per token) and Go (subscription)
are separate services with separate model catalogues, but the same key works for both.

`LLM_MODEL` is always required (`OPENAI_MODEL` is still honoured for backwards
compatibility), and `LLM_BASE_URL` overrides the preset for any provider.

```env
# OpenCode Zen
LLM_PROVIDER=opencode-zen
LLM_API_KEY=...
LLM_MODEL=big-pickle

# OpenCode Go
LLM_PROVIDER=opencode-go
LLM_API_KEY=...
LLM_MODEL=kimi-k3

# OpenRouter
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-...
LLM_MODEL=openai/gpt-4o
LLM_APP_URL=https://example.com   # optional, sent as HTTP-Referer
LLM_APP_NAME=Nyelvtannaci         # optional, sent as X-Title
OPENROUTER_PRIORITIZE=throughput  # optional, sort providers by this field
```

### Provider quirks

Two OpenAI-only features are disabled automatically for every other provider, since
gateways either reject them or pass them on to models that do:

- the `developer` message role (other providers get the classic `system` role)
- `strict: true` tool schemas with `additionalProperties: false`

Both can be forced either way with `LLM_DEVELOPER_ROLE` and `LLM_STRICT_TOOLS`.
Tool parameter schemas are always emitted fully inlined (no `$ref`/`definitions`),
which several models behind OpenRouter and OpenCode require.

Note that OpenCode serves some models only over `/v1/responses` or `/v1/messages`;
pick a model that is available on `/v1/chat/completions`. `LLM_MODEL` takes the bare
model id (`kimi-k3`) — the `opencode/` and `opencode-go/` prefixes seen in other
tools are their own router namespaces, not part of the API model id.

## More docs coming soon™️
