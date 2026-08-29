import { PROVIDER_CATALOG } from "../../extension/provider-catalog.js";
import { createAnthropicProvider } from "./anthropic.mjs";
import { createOpenAICompatibleProvider } from "./openai-compatible.mjs";
import { ProviderRegistry } from "./registry.mjs";

export function detectMiniMaxKeyType(key) {
  if (!key) return "missing";
  if (key.startsWith("sk-cp-")) return "Token Plan";
  if (key.startsWith("sk-api-")) return "Pay-as-you-go";
  return "unknown";
}

function environmentKey(id) {
  return String(id || "").replace(/-/g, "_").toUpperCase();
}

function resolveProfileEnvironment(profile, env) {
  const prefix = environmentKey(profile.id);
  return {
    apiKey: env[`${prefix}_API_KEY`] || env.SIDEASK_API_KEY || "",
    model: env[`${prefix}_MODEL`] || env.SIDEASK_MODEL || profile.defaultModel || "",
    baseUrl: env[`${prefix}_BASE_URL`] || env.SIDEASK_BASE_URL || profile.defaultBaseUrl || "",
  };
}

function profileDefinition(profile) {
  const definition = {
    id: profile.id,
    displayName: profile.displayName,
    defaultBaseUrl: profile.defaultBaseUrl,
    defaultModel: profile.defaultModel,
    allowCustomBaseUrl: profile.baseUrlEditable,
    apiKeyRequired: profile.apiKeyRequired,
    capabilities: {
      reasoning: true,
      modelDiscovery: profile.modelDiscovery,
    },
    resolveConfig(env) {
      return resolveProfileEnvironment(profile, env);
    },
  };

  if (profile.id === "gemini") {
    definition.requestHeaders = { "x-goog-api-client": "sideask-oai/0.7.0" };
  }
  if (profile.id === "openrouter") {
    definition.requestHeaders = {
      "HTTP-Referer": "https://github.com/horry0214/sideask",
      "X-OpenRouter-Title": "SideAsk",
    };
  }
  return definition;
}

function createCatalogProvider(profile) {
  if (profile.id === "minimax-cn" || profile.id === "minimax-global") {
    return createOpenAICompatibleProvider({
      ...profileDefinition(profile),
      keyTypeDetector: detectMiniMaxKeyType,
      requestDefaults: {
        reasoning_split: true,
        temperature: 1.0,
        top_p: 0.9,
        max_completion_tokens: 2048,
      },
      resolveConfig(env) {
        return {
          apiKey: env.MINIMAX_API_KEY || env.SIDEASK_API_KEY || "",
          model: env.MINIMAX_MODEL || env.SIDEASK_MODEL || profile.defaultModel,
          baseUrl: env.MINIMAX_BASE_URL || env.SIDEASK_BASE_URL || profile.defaultBaseUrl,
          endpoint: env.MINIMAX_URL || "",
        };
      },
    });
  }

  if (profile.id === "openai-compatible") {
    return createOpenAICompatibleProvider({
      ...profileDefinition(profile),
      resolveConfig(env) {
        return {
          displayName: env.OPENAI_COMPATIBLE_NAME || "Custom OpenAI-compatible",
          apiKey: env.OPENAI_COMPATIBLE_API_KEY || env.SIDEASK_API_KEY || "",
          model: env.OPENAI_COMPATIBLE_MODEL || env.SIDEASK_MODEL || "",
          baseUrl: env.OPENAI_COMPATIBLE_BASE_URL || env.SIDEASK_BASE_URL || "",
          endpoint: env.OPENAI_COMPATIBLE_ENDPOINT || "",
        };
      },
    });
  }

  if (profile.protocol === "anthropic") {
    return createAnthropicProvider(profileDefinition(profile));
  }
  return createOpenAICompatibleProvider(profileDefinition(profile));
}

export function createProviderRegistry() {
  const registry = new ProviderRegistry();
  for (const profile of PROVIDER_CATALOG) registry.register(createCatalogProvider(profile));
  return registry;
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

export * from "./anthropic.mjs";
export * from "./errors.mjs";
export * from "./openai-compatible.mjs";
export * from "./registry.mjs";
