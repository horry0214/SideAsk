import assert from "node:assert/strict";
import test from "node:test";
import {
  ProviderErrorCode,
  consumeOpenAISseStream,
  createProviderRegistry,
  parseAnthropicSseLine,
  parseOpenAISseLine,
  providerHttpError,
  redactSensitiveText,
  resolveProviderRuntime,
} from "../providers/index.mjs";
import { createOpenAICompatibleProvider } from "../providers/openai-compatible.mjs";

test("default registry exposes the catalog of first-party, router, inference, and local providers", () => {
  const ids = createProviderRegistry().list().map(provider => provider.id);
  assert.equal(ids.length, 25);
  for (const id of ["minimax-cn", "openai", "anthropic", "gemini", "openrouter", "vercel-ai-gateway", "perplexity", "deepseek", "qwen-cn", "groq", "fireworks", "ollama", "lm-studio", "openai-compatible"]) {
    assert.equal(ids.includes(id), true, `missing ${id}`);
  }
});

test("legacy MiniMax CN Token Plan configuration remains compatible", () => {
  const { provider, config } = resolveProviderRuntime({
    MINIMAX_API_KEY: "sk-cp-test-value",
    MINIMAX_MODEL: "MiniMax-M2.7",
    MINIMAX_REGION: "cn",
  });
  assert.equal(provider.id, "minimax-cn");
  assert.equal(config.baseUrl, "https://api.minimaxi.com/v1");
  assert.equal(provider.safeConfigSummary(config).keyType, "Token Plan");
});

test("custom OpenAI-compatible configuration is selected without core branching", () => {
  const { provider, config } = resolveProviderRuntime({
    SIDEASK_PROVIDER_ID: "openai-compatible",
    OPENAI_COMPATIBLE_NAME: "My Provider",
    OPENAI_COMPATIBLE_BASE_URL: "https://example.test/v1/",
    OPENAI_COMPATIBLE_API_KEY: "local-test-key",
    OPENAI_COMPATIBLE_MODEL: "my-model",
  });
  assert.equal(provider.id, "openai-compatible");
  assert.equal(config.baseUrl, "https://example.test/v1");
  assert.deepEqual(provider.validateConfig(config), { ok: true, issues: [] });
});

test("custom providers require HTTPS except for loopback development", () => {
  const provider = createOpenAICompatibleProvider({
    id: "secure-test",
    displayName: "Secure test",
    allowCustomBaseUrl: true,
  });
  assert.equal(provider.validateConfig({ apiKey: "test", model: "model", baseUrl: "http://example.test/v1" }).ok, false);
  assert.equal(provider.validateConfig({ apiKey: "test", model: "model", baseUrl: "http://127.0.0.1:9000/v1" }).ok, true);
  assert.equal(provider.validateConfig({ apiKey: "test", model: "model", baseUrl: "https://example.test/v1" }).ok, true);
});

test("local OpenAI-compatible profiles do not require an API key", () => {
  const provider = createProviderRegistry().get("ollama");
  const config = provider.resolveClientConfig({ model: "qwen3:8b" });
  assert.equal(config.baseUrl, "http://127.0.0.1:11434/v1");
  assert.deepEqual(provider.validateConfig(config), { ok: true, issues: [] });
});

test("OpenAI-compatible SSE parser only forwards answer content", () => {
  assert.equal(parseOpenAISseLine('data: {"choices":[{"delta":{"content":"你好"}}]}'), "你好");
  assert.equal(parseOpenAISseLine('data: {"choices":[{"delta":{"reasoning_content":"hidden"}}]}'), "");
  assert.equal(parseOpenAISseLine("data: [DONE]"), "");
});

test("Anthropic SSE parser only forwards text deltas", () => {
  assert.equal(parseAnthropicSseLine('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"SideAsk"}}'), "SideAsk");
  assert.equal(parseAnthropicSseLine('data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"hidden"}}'), "");
});

test("Anthropic adapter normalizes system messages and streamed text", async () => {
  const provider = createProviderRegistry().get("anthropic");
  const config = provider.resolveClientConfig({ apiKey: "anthropic-test", model: "claude-sonnet-5" });
  let captured;
  const output = [];
  await provider.chatStream({
    messages: [
      { role: "system", content: "Stay concise." },
      { role: "user", content: "hello" },
    ],
  }, config, { onDelta: delta => output.push(delta) }, async (url, options) => {
    captured = { url, options };
    return new Response('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"world"}}\n\n', {
      headers: { "content-type": "text/event-stream" },
    });
  });
  const body = JSON.parse(captured.options.body);
  assert.equal(captured.url, "https://api.anthropic.com/v1/messages");
  assert.equal(captured.options.headers["x-api-key"], "anthropic-test");
  assert.equal(body.system, "Stay concise.");
  assert.deepEqual(body.messages, [{ role: "user", content: "hello" }]);
  assert.equal(output.join(""), "world");
});

test("SSE parser survives arbitrary network chunk boundaries", async () => {
  const encoder = new TextEncoder();
  const chunks = [
    'data: {"choices":[{"delta":{"con',
    'tent":"Side"}}]}\n\ndata: {"choices":[{"delta":{"content":"Ask"}}]}\n\n',
    "data: [DONE]\n\n",
  ];
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
  const output = [];
  const result = await consumeOpenAISseStream(stream, delta => output.push(delta));
  assert.equal(output.join(""), "SideAsk");
  assert.deepEqual(result, { deltaCount: 2, textLength: 7 });
});

test("OpenAI-compatible provider rejects an empty streamed answer", async () => {
  const { provider, config } = resolveProviderRuntime({
    SIDEASK_PROVIDER_ID: "openai-compatible",
    OPENAI_COMPATIBLE_BASE_URL: "https://example.test/v1",
    OPENAI_COMPATIBLE_API_KEY: "local-test-key",
    OPENAI_COMPATIBLE_MODEL: "my-model",
  });
  let ready = false;
  await assert.rejects(
    provider.chatStream({ messages: [{ role: "user", content: "hello" }] }, config, {
      onReady: () => { ready = true; },
    }, async () => new Response(
      'data: {"choices":[{"delta":{"reasoning_content":"hidden"}}]}\n\ndata: [DONE]\n\n',
      { headers: { "content-type": "text/event-stream" } },
    )),
    error => error.code === ProviderErrorCode.INVALID_PROVIDER_RESPONSE
      && /空响应/.test(error.message),
  );
  assert.equal(ready, false);
});

test("OpenAI-compatible provider normalizes request and streamed response", async () => {
  const { provider, config } = resolveProviderRuntime({
    SIDEASK_PROVIDER_ID: "openai-compatible",
    OPENAI_COMPATIBLE_BASE_URL: "https://example.test/v1",
    OPENAI_COMPATIBLE_API_KEY: "local-test-key",
    OPENAI_COMPATIBLE_MODEL: "my-model",
  });
  let captured;
  const output = [];
  await provider.chatStream({
    messages: [{ role: "user", content: "hello" }],
  }, config, {
    onDelta: delta => output.push(delta),
  }, async (url, options) => {
    captured = { url, options };
    return new Response('data: {"choices":[{"delta":{"content":"world"}}]}\n\ndata: [DONE]\n\n', {
      headers: { "content-type": "text/event-stream" },
    });
  });
  assert.equal(captured.url, "https://example.test/v1/chat/completions");
  assert.equal(JSON.parse(captured.options.body).model, "my-model");
  assert.equal(output.join(""), "world");
});

test("OpenAI-compatible provider accepts a non-streaming JSON fallback", async () => {
  const { provider, config } = resolveProviderRuntime({
    SIDEASK_PROVIDER_ID: "openai-compatible",
    OPENAI_COMPATIBLE_BASE_URL: "https://example.test/v1",
    OPENAI_COMPATIBLE_API_KEY: "local-test-key",
    OPENAI_COMPATIBLE_MODEL: "my-model",
  });
  const output = [];
  await provider.chatStream({ messages: [{ role: "user", content: "hello" }] }, config, {
    onDelta: delta => output.push(delta),
  }, async () => new Response(JSON.stringify({
    choices: [{ message: { content: "fallback" } }],
  }), { headers: { "content-type": "application/json" } }));
  assert.equal(output.join(""), "fallback");
});

test("provider connection test discovers models without a chat request", async () => {
  const registry = createProviderRegistry();
  const provider = registry.get("openai-compatible");
  const config = provider.resolveClientConfig({
    displayName: "Test",
    baseUrl: "https://example.test/v1/",
    apiKey: "local-key",
    model: "model-b",
  });
  let request;
  const result = await provider.testConnection(config, async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ data: [{ id: "model-a" }, { id: "model-b" }] }), {
      headers: { "content-type": "application/json" },
    });
  });
  assert.equal(request.url, "https://example.test/v1/models");
  assert.equal(request.options.method, "GET");
  assert.equal(result.modelAvailable, true);
  assert.equal(result.discoveredModels, 2);
});

test("provider HTTP errors are normalized without returning upstream text", () => {
  assert.equal(providerHttpError(401, "raw vendor response", "minimax-cn").code, ProviderErrorCode.INVALID_API_KEY);
  assert.equal(providerHttpError(404, "raw vendor response", "custom").code, ProviderErrorCode.MODEL_NOT_FOUND);
  assert.equal(providerHttpError(429, "insufficient_quota", "custom").code, ProviderErrorCode.QUOTA_EXHAUSTED);
});

test("diagnostic text redacts keys and URL tokens", () => {
  const redacted = redactSensitiveText("Bearer abcdef sk-cp-secretvalue123 ?token=very-secret");
  assert.equal(redacted.includes("secretvalue123"), false);
  assert.equal(redacted.includes("very-secret"), false);
});
