import { ProviderError, ProviderErrorCode } from "./errors.mjs";

export class ProviderRegistry {
  #providers = new Map();

  register(provider) {
    if (!provider?.id || typeof provider.chatStream !== "function") {
      throw new TypeError("Provider must include id and chatStream().");
    }
    if (this.#providers.has(provider.id)) {
      throw new TypeError(`Provider already registered: ${provider.id}`);
    }
    this.#providers.set(provider.id, Object.freeze(provider));
    return this;
  }

  get(id) {
    const provider = this.#providers.get(id);
    if (!provider) {
      throw new ProviderError(ProviderErrorCode.INVALID_PROVIDER_CONFIG, {
        providerId: id || "missing",
        message: `未知 Provider：${id || "（未设置）"}。`,
      });
    }
    return provider;
  }

  list() {
    return [...this.#providers.values()].map(provider => ({
      id: provider.id,
      displayName: provider.displayName,
      apiMode: provider.apiMode,
      capabilities: provider.capabilities,
    }));
  }
}
