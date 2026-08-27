export const ProviderErrorCode = Object.freeze({
  INVALID_API_KEY: "invalid_api_key",
  MODEL_NOT_FOUND: "model_not_found",
  RATE_LIMITED: "rate_limited",
  QUOTA_EXHAUSTED: "quota_exhausted",
  PROVIDER_UNREACHABLE: "provider_unreachable",
  NETWORK_FAILURE: "network_failure",
  INVALID_PROVIDER_CONFIG: "invalid_provider_config",
  INVALID_PROVIDER_RESPONSE: "invalid_provider_response",
  REQUEST_ABORTED: "request_aborted",
});

const PUBLIC_MESSAGES = Object.freeze({
  [ProviderErrorCode.INVALID_API_KEY]: "API Key 无效，或与 Provider 区域不匹配。请检查本地配置。",
  [ProviderErrorCode.MODEL_NOT_FOUND]: "当前 Provider 找不到这个模型。请检查模型名称。",
  [ProviderErrorCode.RATE_LIMITED]: "请求过于频繁，请稍后再试。",
  [ProviderErrorCode.QUOTA_EXHAUSTED]: "当前 Provider 的额度或 Token Plan 已用尽。",
  [ProviderErrorCode.PROVIDER_UNREACHABLE]: "Provider 暂时不可用，请稍后再试。",
  [ProviderErrorCode.NETWORK_FAILURE]: "无法连接 Provider。请检查网络、本地网关或 Base URL。",
  [ProviderErrorCode.INVALID_PROVIDER_CONFIG]: "Provider 配置不完整。请检查 API Key、Base URL 和模型。",
  [ProviderErrorCode.INVALID_PROVIDER_RESPONSE]: "Provider 返回了无法识别的响应。",
  [ProviderErrorCode.REQUEST_ABORTED]: "请求已取消。",
});

const HTTP_STATUS_BY_CODE = Object.freeze({
  [ProviderErrorCode.INVALID_API_KEY]: 401,
  [ProviderErrorCode.MODEL_NOT_FOUND]: 404,
  [ProviderErrorCode.RATE_LIMITED]: 429,
  [ProviderErrorCode.QUOTA_EXHAUSTED]: 402,
  [ProviderErrorCode.PROVIDER_UNREACHABLE]: 502,
  [ProviderErrorCode.NETWORK_FAILURE]: 502,
  [ProviderErrorCode.INVALID_PROVIDER_CONFIG]: 400,
  [ProviderErrorCode.INVALID_PROVIDER_RESPONSE]: 502,
  [ProviderErrorCode.REQUEST_ABORTED]: 499,
});

export class ProviderError extends Error {
  constructor(code, options = {}) {
    super(options.message || PUBLIC_MESSAGES[code] || "Provider 请求失败。");
    this.name = "ProviderError";
    this.code = code;
    this.providerId = options.providerId || "unknown";
    this.upstreamStatus = options.upstreamStatus;
    this.httpStatus = options.httpStatus || HTTP_STATUS_BY_CODE[code] || 500;
    this.retryable = options.retryable ?? [
      ProviderErrorCode.RATE_LIMITED,
      ProviderErrorCode.PROVIDER_UNREACHABLE,
      ProviderErrorCode.NETWORK_FAILURE,
    ].includes(code);
    this.cause = options.cause;
  }
}

export function providerHttpError(status, upstreamText = "", providerId = "unknown") {
  const normalizedText = String(upstreamText).toLowerCase();
  let code = ProviderErrorCode.PROVIDER_UNREACHABLE;

  if (status === 401 || status === 403) code = ProviderErrorCode.INVALID_API_KEY;
  else if (status === 404) code = ProviderErrorCode.MODEL_NOT_FOUND;
  else if (status === 402 || /quota|insufficient[_ -]?quota|token plan.*(exhaust|limit)/i.test(normalizedText)) {
    code = ProviderErrorCode.QUOTA_EXHAUSTED;
  } else if (status === 429) code = ProviderErrorCode.RATE_LIMITED;

  return new ProviderError(code, { providerId, upstreamStatus: status });
}

export function normalizeProviderError(error, providerId = "unknown") {
  if (error instanceof ProviderError) return error;
  if (error?.name === "AbortError") {
    return new ProviderError(ProviderErrorCode.REQUEST_ABORTED, { providerId, cause: error });
  }
  return new ProviderError(ProviderErrorCode.NETWORK_FAILURE, { providerId, cause: error });
}

export function publicProviderError(error, providerId = "unknown") {
  const normalized = normalizeProviderError(error, providerId);
  return {
    status: normalized.httpStatus,
    body: {
      error: {
        code: normalized.code,
        message: normalized.message,
        retryable: normalized.retryable,
      },
    },
    log: {
      providerId: normalized.providerId,
      code: normalized.code,
      upstreamStatus: normalized.upstreamStatus,
    },
  };
}

export function redactSensitiveText(value) {
  return String(value || "")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "sk-[REDACTED]")
    .replace(/([?&](?:key|token|api_key)=)[^&\s]+/gi, "$1[REDACTED]");
}
