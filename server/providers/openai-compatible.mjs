import {
  ProviderError,
  ProviderErrorCode,
  normalizeProviderError,
  providerHttpError,
} from "./errors.mjs";

function normalizedBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isSecureProviderUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:") return true;
    return parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function contentFromParts(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map(part => {
      if (typeof part === "string") return part;
      if (part?.type === "text" && typeof part.text === "string") return part.text;
      return "";
    })
    .join("");
}

export function extractOpenAIText(payload) {
  const choice = payload?.choices?.[0];
  return contentFromParts(choice?.delta?.content)
    || contentFromParts(choice?.message?.content)
    || (typeof choice?.text === "string" ? choice.text : "");
}

export function parseOpenAISseLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.startsWith("data:")) return "";
  const data = trimmed.slice(5).trim();
  if (!data || data === "[DONE]") return "";
  try {
    return extractOpenAIText(JSON.parse(data));
  } catch {
    return "";
  }
}

export async function consumeOpenAISseStream(body, onDelta) {
  if (!body?.getReader) {
    throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_RESPONSE);
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let deltaCount = 0;
  let textLength = 0;

  const emit = delta => {
    if (!delta) return;
    deltaCount += 1;
    textLength += delta.length;
    onDelta(delta);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const delta = parseOpenAISseLine(line);
      emit(delta);
    }
  }

  buffer += decoder.decode();
  if (buffer) {
    const delta = parseOpenAISseLine(buffer);
    emit(delta);
  }

  return { deltaCount, textLength };
}

export function createOpenAICompatibleProvider(definition) {
  const capabilities = Object.freeze({
    streaming: true,
    reasoning: Boolean(definition.capabilities?.reasoning),
    vision: Boolean(definition.capabilities?.vision),
    tools: Boolean(definition.capabilities?.tools),
    modelDiscovery: Boolean(definition.capabilities?.modelDiscovery),
  });

  return {
    id: definition.id,
    displayName: definition.displayName,
    apiMode: "openai-compatible",
    capabilities,

    resolveConfig(env) {
      const resolved = definition.resolveConfig?.(env) || {};
      return {
        ...resolved,
        baseUrl: normalizedBaseUrl(resolved.baseUrl || definition.defaultBaseUrl),
        model: String(resolved.model || definition.defaultModel || "").trim(),
      };
    },

    resolveClientConfig(input = {}) {
      const allowCustomBaseUrl = Boolean(definition.allowCustomBaseUrl);
      return {
        displayName: String(input.displayName || definition.displayName).trim().slice(0, 120),
        apiKey: String(input.apiKey || "").trim().slice(0, 10_000),
        model: String(input.model || definition.defaultModel || "").trim().slice(0, 300),
        baseUrl: normalizedBaseUrl(allowCustomBaseUrl ? input.baseUrl : definition.defaultBaseUrl),
        endpoint: "",
      };
    },

    validateConfig(config) {
      const issues = [];
      if (!String(config?.apiKey || "").trim()) issues.push("apiKey");
      if (!String(config?.model || "").trim()) issues.push("model");
      const endpoint = config?.endpoint || config?.baseUrl;
      if (!isSecureProviderUrl(endpoint)) issues.push(config?.endpoint ? "endpoint" : "baseUrl");
      return { ok: issues.length === 0, issues };
    },

    safeConfigSummary(config) {
      return {
        provider: definition.id,
        displayName: config?.displayName || definition.displayName,
        model: config?.model || "",
        endpoint: config?.endpoint || `${normalizedBaseUrl(config?.baseUrl)}/chat/completions`,
        apiKeyConfigured: Boolean(config?.apiKey),
        keyType: definition.keyTypeDetector?.(config?.apiKey) || undefined,
      };
    },

    async testConnection(config, fetchImpl = globalThis.fetch) {
      const validation = this.validateConfig(config);
      if (!validation.ok) {
        throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_CONFIG, { providerId: definition.id });
      }
      const baseUrl = normalizedBaseUrl(config.baseUrl)
        || normalizedBaseUrl(config.endpoint).replace(/\/chat\/completions$/i, "");
      if (!baseUrl) {
        throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_CONFIG, { providerId: definition.id });
      }
      let response;
      try {
        response = await fetchImpl(`${baseUrl}/models`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${config.apiKey}` },
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        throw normalizeProviderError(error, definition.id);
      }
      if (response.status === 404 || response.status === 405) {
        throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_RESPONSE, {
          providerId: definition.id,
          upstreamStatus: response.status,
          message: "Provider 未提供兼容的 /models 接口，暂时无法完成无消耗连接测试。",
        });
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
        modelAvailable: models.length ? models.includes(config.model) : null,
        discoveredModels: models.length,
      };
    },

    async chatStream(request, config, callbacks = {}, fetchImpl = globalThis.fetch) {
      const validation = this.validateConfig(config);
      if (!validation.ok) {
        throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_CONFIG, {
          providerId: definition.id,
        });
      }

      const endpoint = config.endpoint || `${normalizedBaseUrl(config.baseUrl)}/chat/completions`;
      const parameters = request.parameters || {};
      const requestBody = {
        ...(definition.requestDefaults || {}),
        ...(config.requestDefaults || {}),
        model: config.model,
        messages: request.messages,
        stream: true,
      };

      if (parameters.temperature !== undefined) requestBody.temperature = parameters.temperature;
      if (parameters.topP !== undefined) requestBody.top_p = parameters.topP;
      if (parameters.maxCompletionTokens !== undefined) {
        requestBody.max_completion_tokens = parameters.maxCompletionTokens;
      }

      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.apiKey}`,
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

      if (!response.body) {
        throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_RESPONSE, {
          providerId: definition.id,
        });
      }

      const contentType = response.headers?.get?.("content-type") || "";
      if (contentType.includes("application/json")) {
        let payload;
        try {
          payload = await response.json();
        } catch (error) {
          throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_RESPONSE, {
            providerId: definition.id,
            cause: error,
          });
        }
        const text = extractOpenAIText(payload);
        if (!text) {
          throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_RESPONSE, {
            providerId: definition.id,
          });
        }
        callbacks.onReady?.();
        callbacks.onDelta?.(text);
        callbacks.onDone?.();
        return;
      }

      try {
        let ready = false;
        const result = await consumeOpenAISseStream(response.body, delta => {
          if (!ready) {
            ready = true;
            callbacks.onReady?.();
          }
          callbacks.onDelta?.(delta);
        });
        if (!result.textLength) {
          throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_RESPONSE, {
            providerId: definition.id,
            message: "Provider 返回了空响应。请检查模型、额度或内容安全限制后重试。",
          });
        }
      } catch (error) {
        throw normalizeProviderError(error, definition.id);
      }
      callbacks.onDone?.();
    },
  };
}
