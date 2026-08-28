# Provider Architecture

## Design

SideAsk follows the useful part of the [Hermes Agent provider design](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/model-provider-plugin.md): Provider metadata is declarative, while transport-specific behavior stays in a small adapter layer.

```text
extension/provider-catalog.js
  └─ id · display name · protocol · default Base URL · model suggestions · auth policy
       └─ Provider Registry
            ├─ OpenAI-compatible adapter
            └─ Anthropic Messages adapter
```

The browser settings UI, VS Code Companion, Gateway registry, Local Provider Vault, environment-variable fallback, and store package use the same catalog. Adding another compatible service normally requires one profile rather than UI, storage, and server branches.

## Included profiles

| Group | Profiles |
| --- | --- |
| Global first-party | MiniMax Global, OpenAI, Anthropic, Google Gemini, xAI, Alibaba Qwen Global, Z.AI |
| China and Asia | MiniMax CN, DeepSeek, Alibaba Qwen China, BigModel, SiliconFlow |
| Routers | OpenRouter, Vercel AI Gateway, Perplexity, Hugging Face Inference Providers |
| Inference | Groq, Fireworks AI, Mistral AI, Together AI, Cerebras, NVIDIA NIM |
| Local | Ollama, LM Studio |
| Custom | Any OpenAI-compatible Base URL |

The catalog contains 25 profiles. All Base URLs can be overridden so users can select a region, workspace endpoint, proxy, or self-hosted deployment without editing code. Only HTTPS is accepted, except loopback HTTP for local services.

Official compatibility references include [Google Gemini](https://ai.google.dev/gemini-api/docs/partner-integration), [OpenRouter](https://openrouter.ai/docs/quickstart), [Vercel AI Gateway](https://vercel.com/docs/ai-gateway/sdks-and-apis), [Perplexity](https://docs.perplexity.ai/docs/sonar/openai-compatibility), [Fireworks AI](https://docs.fireworks.ai/tools-sdks/openai-compatibility), [DeepSeek](https://api-docs.deepseek.com/), [Groq](https://console.groq.com/docs/openai), [Together AI](https://docs.together.ai/docs/inference/openai-compatibility), [Cerebras](https://inference-docs.cerebras.ai/resources/openai), [Hugging Face](https://huggingface.co/docs/inference-providers/en/index), [Alibaba Model Studio](https://help.aliyun.com/en/model-studio/compatibility-of-openai-with-dashscope), [Z.AI](https://docs.z.ai/guides/develop/http/introduction), and [NVIDIA NIM](https://docs.api.nvidia.com/nim/reference/llm-apis).

## Provider contract

```ts
interface Provider {
  id: string
  displayName: string
  apiMode: "openai-compatible" | "anthropic"
  capabilities: {
    streaming: boolean
    reasoning?: boolean
    vision?: boolean
    tools?: boolean
    modelDiscovery?: boolean
  }
  validateConfig(config): ValidationResult
  testConnection(config): Promise<ModelDiscoveryResult>
  chatStream(request, config, callbacks, fetchImpl?): Promise<void>
}
```

`callbacks.onReady()` fires only after readable answer text arrives. This lets the Gateway return a normalized error before committing an HTTP 200 response.

## Model discovery

The Provider dialog can test an unsaved draft and fetch a live model list. The test uses a model-list endpoint and does not create a chat completion:

- OpenAI-compatible profiles: `GET {baseUrl}/models`
- Anthropic: `GET {baseUrl}/models?limit=100` with `x-api-key` and `anthropic-version`

If a Provider does not expose model discovery, the user can still enter a model ID manually. Catalog suggestions are only onboarding defaults; the live Provider response remains authoritative.

## Normalized request and stream

```ts
interface NormalizedChatRequest {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  parameters?: {
    temperature?: number
    topP?: number
    maxCompletionTokens?: number
  }
}
```

The OpenAI-compatible parser forwards answer content from `choices[0].delta.content` and ignores reasoning traces. The Anthropic adapter separates system instructions from conversation messages and forwards only `content_block_delta` events whose delta type is `text_delta`.

## Configuration and compatibility

Profiles are stored once in the Gateway's on-device Provider Vault. API keys are encrypted with AES-256-GCM using a separate random local key and are never returned by the configuration API. Browser and VS Code clients receive only redacted metadata; the Gateway resolves their shared default internally. API keys never enter page content scripts or VS Code Webviews. Existing browser IndexedDB and VS Code Secret Storage records are migrated non-destructively.

Default Vault locations:

- Windows: `%APPDATA%\SideAsk`
- macOS: `~/Library/Application Support/SideAsk`
- Linux: `$XDG_CONFIG_HOME/sideask` or `~/.config/sideask`

The directory contains `provider-vault.json` and a separate `.provider-vault-key`. `SIDEASK_DATA_DIR` overrides the location for portable or development setups. Encryption protects credentials from casual plaintext disclosure; software running as the same OS user remains inside the local trust boundary, so the directory should not be synced or shared casually. Stop the Gateway and remove that directory only when intentionally deleting all shared Provider configuration.

When no shared profile is configured, the Gateway uses `.env`. Every catalog profile accepts the generic `SIDEASK_API_KEY`, `SIDEASK_MODEL`, and `SIDEASK_BASE_URL` variables, plus profile-specific names derived from its ID, such as `ANTHROPIC_API_KEY`. MiniMax and Custom OpenAI-compatible legacy variables remain supported.

Local profiles do not require an API key. Remote profiles do. Provider errors are normalized and logs never contain credentials, Authorization headers, prompts, or raw upstream error bodies.
