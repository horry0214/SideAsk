import { createOpenAICompatibleProvider } from "./openai-compatible.mjs";
import { ProviderRegistry } from "./registry.mjs";

export function detectMiniMaxKeyType(key) {
  if (!key) return "missing";
  if (key.startsWith("sk-cp-")) return "Token Plan";
  if (key.startsWith("sk-api-")) return "Pay-as-you-go";
  return "unknown";
}

function miniMaxProvider({ id, displayName, baseUrl }) {
  return createOpenAICompatibleProvider({
    id,
    displayName,
    defaultBaseUrl: baseUrl,
    defaultModel: "MiniMax-M2.7",
    capabilities: { reasoning: true, modelDiscovery: true },
    keyTypeDetector: detectMiniMaxKeyType,
    requestDefaults: {
      reasoning_split: true,
      temperature: 1.0,
      top_p: 0.9,
      max_completion_tokens: 2048,
    },
    resolveConfig(env) {
      return {
        apiKey: env.MINIMAX_API_KEY || "",
        model: env.MINIMAX_MODEL || "MiniMax-M2.7",
        baseUrl: env.MINIMAX_BASE_URL || baseUrl,
        endpoint: env.MINIMAX_URL || "",
      };
    },
  });
}

export function createProviderRegistry() {
  return new ProviderRegistry()
    .register(miniMaxProvider({
      id: "minimax-cn",
      displayName: "MiniMax CN",
      baseUrl: "https://api.minimaxi.com/v1",
    }))
    .register(miniMaxProvider({
      id: "minimax-global",
      displayName: "MiniMax Global",
      baseUrl: "https://api.minimax.io/v1",
    }))
    .register(createOpenAICompatibleProvider({
      id: "openai-compatible",
      displayName: "Custom OpenAI-compatible",
      capabilities: { modelDiscovery: true },
      allowCustomBaseUrl: true,
      resolveConfig(env) {
        return {
          displayName: env.OPENAI_COMPATIBLE_NAME || "Custom OpenAI-compatible",
          apiKey: env.OPENAI_COMPATIBLE_API_KEY || "",
          model: env.OPENAI_COMPATIBLE_MODEL || "",
          baseUrl: env.OPENAI_COMPATIBLE_BASE_URL || "",
          endpoint: env.OPENAI_COMPATIBLE_ENDPOINT || "",
        };
      },
    }));
}

export function resolveProviderRuntime(env = process.env, registry = createProviderRegistry()) {
  const legacyRegion = String(env.MINIMAX_REGION || "cn").toLowerCase();
  const defaultProviderId = legacyRegion === "global" ? "minimax-global" : "minimax-cn";
  const providerId = String(env.SIDEASK_PROVIDER_ID || defaultProviderId).trim();
  const provider = registry.get(providerId);
  return {
    provider,
    config: provider.resolveConfig(env),
    registry,
  };
}

export * from "./errors.mjs";
export * from "./openai-compatible.mjs";
export * from "./registry.mjs";
