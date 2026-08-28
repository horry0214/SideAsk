import {
  ProviderError,
  ProviderErrorCode,
  normalizeProviderError,
  providerHttpError,
} from "./errors.mjs";
import { isSecureProviderUrl, normalizedBaseUrl } from "./openai-compatible.mjs";

const ANTHROPIC_VERSION = "2023-06-01";

export function extractAnthropicText(payload) {
  if (payload?.type === "content_block_delta" && payload?.delta?.type === "text_delta") {
    return typeof payload.delta.text === "string" ? payload.delta.text : "";
  }
  if (!Array.isArray(payload?.content)) return "";
  return payload.content
    .filter(part => part?.type === "text" && typeof part.text === "string")
    .map(part => part.text)
    .join("");
}

export function parseAnthropicSseLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.startsWith("data:")) return "";
  const data = trimmed.slice(5).trim();
  if (!data || data === "[DONE]") return "";
  try { return extractAnthropicText(JSON.parse(data)); } catch { return ""; }
}

async function consumeAnthropicStream(body, onDelta) {
  if (!body?.getReader) throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_RESPONSE);
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let textLength = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const delta = parseAnthropicSseLine(line);
      if (delta) {
        textLength += delta.length;
        onDelta(delta);
      }
    }
  }
  buffer += decoder.decode();
  const finalDelta = parseAnthropicSseLine(buffer);
  if (finalDelta) {
    textLength += finalDelta.length;
    onDelta(finalDelta);
  }
  return textLength;
}

function anthropicHeaders(apiKey) {
  return {
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
  };
}

export function createAnthropicProvider(definition) {
  return {
    id: definition.id,
    displayName: definition.displayName,
    apiMode: "anthropic",
    capabilities: Object.freeze({
      streaming: true,
      reasoning: true,
      vision: true,
      tools: true,
      modelDiscovery: true,
    }),

    resolveConfig(env) {
      const resolved = definition.resolveConfig?.(env) || {};
      return {
        ...resolved,
        baseUrl: normalizedBaseUrl(resolved.baseUrl || definition.defaultBaseUrl),
        model: String(resolved.model || definition.defaultModel || "").trim(),
      };
    },

    resolveClientConfig(input = {}) {
      return {
        displayName: String(input.displayName || definition.displayName).trim().slice(0, 120),
        apiKey: String(input.apiKey || "").trim().slice(0, 10_000),
        model: String(input.model || definition.defaultModel || "").trim().slice(0, 300),
        baseUrl: normalizedBaseUrl(input.baseUrl || definition.defaultBaseUrl),
        endpoint: "",
      };
    },

    validateConfig(config) {
      const issues = [];
      if (!String(config?.apiKey || "").trim()) issues.push("apiKey");
      if (!String(config?.model || "").trim()) issues.push("model");
      if (!isSecureProviderUrl(config?.baseUrl)) issues.push("baseUrl");
      return { ok: issues.length === 0, issues };
    },

    safeConfigSummary(config) {
      return {
        provider: definition.id,
        displayName: config?.displayName || definition.displayName,
        model: config?.model || "",
        endpoint: `${normalizedBaseUrl(config?.baseUrl)}/messages`,
        apiKeyConfigured: Boolean(config?.apiKey),
      };
    },

    async testConnection(config, fetchImpl = globalThis.fetch) {
      if (!String(config?.apiKey || "").trim() || !isSecureProviderUrl(config?.baseUrl)) {
        throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_CONFIG, { providerId: definition.id });
      }
      let response;
      try {
        response = await fetchImpl(`${normalizedBaseUrl(config.baseUrl)}/models?limit=100`, {
          method: "GET",
          headers: anthropicHeaders(config.apiKey),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        throw normalizeProviderError(error, definition.id);
      }
      if (!response.ok) {
        const upstreamText = await response.text().catch(() => "");
        throw providerHttpError(response.status, upstreamText.slice(0, 16_000), definition.id);
      }
      let payload = {};
      try { payload = await response.json(); } catch (_) {}
      const models = Array.isArray(payload?.data)
        ? payload.data.map(item => item?.id).filter(id => typeof id === "string").slice(0, 200)
        : [];
      return {
        ok: true,
        providerId: definition.id,
        model: config.model,
        modelAvailable: config.model && models.length ? models.includes(config.model) : null,
        discoveredModels: models.length,
        models,
      };
    },

    async chatStream(request, config, callbacks = {}, fetchImpl = globalThis.fetch) {
      const validation = this.validateConfig(config);
      if (!validation.ok) {
        throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_CONFIG, { providerId: definition.id });
      }
      const system = request.messages
        .filter(message => message.role === "system")
        .map(message => message.content)
        .filter(Boolean)
        .join("\n\n");
      const messages = request.messages
        .filter(message => message.role === "user" || message.role === "assistant")
        .map(message => ({ role: message.role, content: message.content }));
      const parameters = request.parameters || {};
      const requestBody = {
        model: config.model,
        messages,
        max_tokens: parameters.maxCompletionTokens || 4096,
        stream: true,
        ...(system ? { system } : {}),
      };
      if (parameters.temperature !== undefined) requestBody.temperature = parameters.temperature;
      if (parameters.topP !== undefined) requestBody.top_p = parameters.topP;

      let response;
      try {
        response = await fetchImpl(`${normalizedBaseUrl(config.baseUrl)}/messages`, {
          method: "POST",
          headers: {
            ...anthropicHeaders(config.apiKey),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: request.signal,
        });
      } catch (error) {
        throw normalizeProviderError(error, definition.id);
      }
      if (!response.ok) {
        const upstreamText = await response.text().catch(() => "");
        throw providerHttpError(response.status, upstreamText.slice(0, 16_000), definition.id);
      }

      const contentType = response.headers?.get?.("content-type") || "";
      if (contentType.includes("application/json")) {
        let payload;
        try { payload = await response.json(); } catch (error) {
          throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_RESPONSE, { providerId: definition.id, cause: error });
        }
        const text = extractAnthropicText(payload);
        if (!text) throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_RESPONSE, { providerId: definition.id });
        callbacks.onReady?.();
        callbacks.onDelta?.(text);
        callbacks.onDone?.();
        return;
      }

      let ready = false;
      let textLength = 0;
      try {
        textLength = await consumeAnthropicStream(response.body, delta => {
          if (!ready) {
            ready = true;
            callbacks.onReady?.();
          }
          callbacks.onDelta?.(delta);
        });
      } catch (error) {
        throw normalizeProviderError(error, definition.id);
      }
      if (!textLength) {
        throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_RESPONSE, {
          providerId: definition.id,
          message: "Provider 返回了空响应。请检查模型、额度或内容安全限制后重试。",
        });
      }
      callbacks.onDone?.();
    },
  };
}
