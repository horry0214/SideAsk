const DB_NAME = "sideask";
const DB_VERSION = 1;

const STORE = Object.freeze({
  SETTINGS: "settings",
  PROVIDERS: "providers",
  SESSIONS: "sessions",
  BRANCHES: "branches",
  KNOWLEDGE: "knowledge",
  WEAKNESSES: "weaknesses",
  REVIEWS: "reviews",
});

const BRANCH_STATUSES = new Set(["active", "understood", "unclear", "review"]);
const PROVIDER_TYPES = new Set(["minimax-cn", "minimax-global", "openai-compatible"]);

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
  });
}

function cleanText(value, max = 6000) {
  return String(value || "").trim().slice(0, max);
}

function cleanUrl(value) {
  const input = cleanText(value, 3000);
  if (!input) return "";
  try {
    const url = new URL(input);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return input;
  }
}

function isSecureProviderUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function normalizeConcept(value) {
  return cleanText(value, 500).replace(/\s+/g, " ").toLocaleLowerCase();
}

export function legacySessionToRecords(legacy, now = Date.now()) {
  const createdAt = Number(legacy?.anchor?.createdAt || legacy?.updatedAt || now);
  const sourceUrl = cleanUrl(legacy?.sourceUrl || legacy?.anchor?.url || "");
  const sessionId = `legacy-session-${createdAt}`;
  const branchId = `legacy-${cleanText(legacy?.id || createdAt, 220)}`;
  return {
    session: {
      id: sessionId,
      title: cleanText(legacy?.sourceTitle || "历史阅读", 500),
      sourceUrl,
      sourceTitle: cleanText(legacy?.sourceTitle, 500),
      createdAt,
      updatedAt: Number(legacy?.updatedAt || createdAt),
    },
    branch: {
      id: branchId,
      sessionId,
      parentId: null,
      selectedText: cleanText(legacy?.selectedText, 500),
      sourceContext: cleanText(legacy?.context, 7000),
      sourceTitle: cleanText(legacy?.sourceTitle, 500),
      sourceUrl,
      anchor: legacy?.anchor || null,
      messages: normalizeMessages(legacy?.messages),
      status: legacy?.understood ? "understood" : "active",
      favorite: false,
      createdAt,
      updatedAt: Number(legacy?.updatedAt || createdAt),
    },
  };
}

export function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(message => message && (message.role === "user" || message.role === "assistant"))
    .slice(-40)
    .map(message => ({
      role: message.role,
      content: cleanText(message.content, 10_000),
      modelContent: cleanText(message.modelContent, 10_000) || undefined,
    }));
}

export function deriveKnowledge(existing, branch, now = Date.now()) {
  const concept = cleanText(branch.selectedText, 500);
  const conceptKey = normalizeConcept(concept);
  const sourceBranches = [...new Set([...(existing?.sourceBranches || []), branch.id])];
  const sourceUrls = [...new Set([...(existing?.sourceUrls || []), cleanUrl(branch.sourceUrl)].filter(Boolean))];
  const answer = [...(branch.messages || [])].reverse().find(message => message.role === "assistant" && message.content)?.content || "";
  const isUnclear = branch.status === "unclear";

  return {
    id: existing?.id || crypto.randomUUID(),
    concept: existing?.concept || concept,
    conceptKey,
    explanation: cleanText(answer || existing?.explanation, 8000),
    summary: existing?.summary || "",
    aliases: existing?.aliases || [],
    sourceBranches,
    sourceUrls,
    tags: existing?.tags || [],
    status: isUnclear ? "weak" : "understood",
    confidence: isUnclear ? Math.min(existing?.confidence ?? 0.45, 0.45) : Math.max(existing?.confidence ?? 0.72, 0.72),
    firstSeenAt: existing?.firstSeenAt || branch.createdAt || now,
    lastSeenAt: now,
    askCount: sourceBranches.length,
    reviewCount: existing?.reviewCount || 0,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

export function deriveWeakness(existing, knowledge, reason, branchId, now = Date.now()) {
  const evidenceBranches = [...new Set([...(existing?.evidenceBranches || []), branchId].filter(Boolean))];
  const weight = reason === "repeated_question"
    ? Math.max(existing?.weight || 0, Math.max(1, knowledge.askCount - 2))
    : evidenceBranches.length;
  return {
    id: `${knowledge.id}:${reason}`,
    knowledgeId: knowledge.id,
    reason,
    weight,
    evidenceBranches,
    firstDetectedAt: existing?.firstDetectedAt || now,
    lastDetectedAt: now,
    resolved: false,
  };
}

export class SideAskStorage {
  #databasePromise;

  open() {
    if (this.#databasePromise) return this.#databasePromise;
    this.#databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE.SETTINGS)) db.createObjectStore(STORE.SETTINGS, { keyPath: "key" });
        if (!db.objectStoreNames.contains(STORE.PROVIDERS)) {
          const store = db.createObjectStore(STORE.PROVIDERS, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
          store.createIndex("type", "type");
        }
        if (!db.objectStoreNames.contains(STORE.SESSIONS)) {
          const store = db.createObjectStore(STORE.SESSIONS, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
          store.createIndex("sourceUrl", "sourceUrl");
        }
        if (!db.objectStoreNames.contains(STORE.BRANCHES)) {
          const store = db.createObjectStore(STORE.BRANCHES, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
          store.createIndex("sessionId", "sessionId");
          store.createIndex("status", "status");
          store.createIndex("conceptKey", "conceptKey");
        }
        if (!db.objectStoreNames.contains(STORE.KNOWLEDGE)) {
          const store = db.createObjectStore(STORE.KNOWLEDGE, { keyPath: "id" });
          store.createIndex("conceptKey", "conceptKey", { unique: true });
          store.createIndex("updatedAt", "updatedAt");
          store.createIndex("status", "status");
        }
        if (!db.objectStoreNames.contains(STORE.WEAKNESSES)) {
          const store = db.createObjectStore(STORE.WEAKNESSES, { keyPath: "id" });
          store.createIndex("knowledgeId", "knowledgeId");
          store.createIndex("lastDetectedAt", "lastDetectedAt");
          store.createIndex("resolved", "resolved");
        }
        if (!db.objectStoreNames.contains(STORE.REVIEWS)) {
          const store = db.createObjectStore(STORE.REVIEWS, { keyPath: "id" });
          store.createIndex("scheduledAt", "scheduledAt");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open SideAsk database"));
    });
    return this.#databasePromise;
  }

  async #transaction(storeNames, mode, callback) {
    const db = await this.open();
    const transaction = db.transaction(storeNames, mode);
    const result = await callback(transaction);
    await transactionDone(transaction);
    return result;
  }

  async getSetting(key) {
    return this.#transaction([STORE.SETTINGS], "readonly", async tx => {
      return requestValue(tx.objectStore(STORE.SETTINGS).get(key));
    });
  }

  async setSetting(key, value) {
    return this.#transaction([STORE.SETTINGS], "readwrite", async tx => {
      tx.objectStore(STORE.SETTINGS).put({ key, value, updatedAt: Date.now() });
      return value;
    });
  }

  async migrateLegacyHistory(legacyHistory = []) {
    const migrated = await this.getSetting("legacyHistoryMigrated");
    if (migrated?.value) return { migrated: 0, skipped: true };
    const records = legacyHistory.map(item => legacySessionToRecords(item));
    await this.#transaction([STORE.SETTINGS, STORE.SESSIONS, STORE.BRANCHES], "readwrite", async tx => {
      const sessions = tx.objectStore(STORE.SESSIONS);
      const branches = tx.objectStore(STORE.BRANCHES);
      records.forEach(record => {
        if (record.branch.selectedText) {
          sessions.put(record.session);
          branches.put({ ...record.branch, conceptKey: normalizeConcept(record.branch.selectedText) });
        }
      });
      tx.objectStore(STORE.SETTINGS).put({ key: "legacyHistoryMigrated", value: true, updatedAt: Date.now() });
    });
    return { migrated: records.length, skipped: false };
  }

  async listProviders({ includeSecrets = false } = {}) {
    const providers = await this.#transaction([STORE.PROVIDERS], "readonly", async tx => {
      return requestValue(tx.objectStore(STORE.PROVIDERS).getAll());
    });
    providers.sort((a, b) => b.updatedAt - a.updatedAt);
    if (includeSecrets) return providers;
    return providers.map(({ apiKey, ...provider }) => ({ ...provider, apiKeyConfigured: Boolean(apiKey) }));
  }

  async getProvider(id) {
    if (!id) return null;
    return this.#transaction([STORE.PROVIDERS], "readonly", async tx => {
      return requestValue(tx.objectStore(STORE.PROVIDERS).get(id));
    });
  }

  async saveProvider(input) {
    const now = Date.now();
    const existing = input?.id ? await this.getProvider(input.id) : null;
    const type = cleanText(input?.type || existing?.type, 80);
    if (!PROVIDER_TYPES.has(type)) throw new Error("不支持的 Provider 类型。");
    const apiKey = cleanText(input?.apiKey, 10_000) || existing?.apiKey || "";
    const model = cleanText(input?.model || existing?.model, 300);
    const baseUrl = cleanText(input?.baseUrl || existing?.baseUrl, 2000).replace(/\/+$/, "");
    if (!apiKey) throw new Error("请填写 API Key。");
    if (!model) throw new Error("请填写模型名称。");
    if (type === "openai-compatible" && !isSecureProviderUrl(baseUrl)) {
      throw new Error("Provider Base URL 必须使用 HTTPS；仅 localhost/127.0.0.1 可使用 HTTP。");
    }

    const provider = {
      id: existing?.id || crypto.randomUUID(),
      type,
      displayName: cleanText(input?.displayName || existing?.displayName, 120) || ({
        "minimax-cn": "MiniMax CN",
        "minimax-global": "MiniMax Global",
        "openai-compatible": "OpenAI-compatible",
      })[type],
      baseUrl: type === "openai-compatible" ? baseUrl : "",
      apiKey,
      model,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await this.#transaction([STORE.PROVIDERS], "readwrite", async tx => {
      tx.objectStore(STORE.PROVIDERS).put(provider);
    });

    const defaultSetting = await this.getSetting("defaultProviderId");
    if (!defaultSetting?.value) await this.setDefaultProvider(provider.id);
    const { apiKey: _secret, ...safe } = provider;
    return { ...safe, apiKeyConfigured: true };
  }

  async deleteProvider(id) {
    const defaultSetting = await this.getSetting("defaultProviderId");
    await this.#transaction([STORE.PROVIDERS, STORE.SETTINGS], "readwrite", async tx => {
      tx.objectStore(STORE.PROVIDERS).delete(id);
      if (defaultSetting?.value === id) tx.objectStore(STORE.SETTINGS).delete("defaultProviderId");
    });
    if (defaultSetting?.value === id) {
      const remaining = await this.listProviders({ includeSecrets: true });
      if (remaining[0]) await this.setDefaultProvider(remaining[0].id);
    }
    return true;
  }

  async setDefaultProvider(id) {
    const provider = await this.getProvider(id);
    if (!provider) throw new Error("Provider 不存在。");
    await this.setSetting("defaultProviderId", id);
    return id;
  }

  async getActiveProvider() {
    const setting = await this.getSetting("defaultProviderId");
    if (!setting?.value) return null;
    return this.getProvider(setting.value);
  }

  async listProviderState() {
    const [providers, setting] = await Promise.all([
      this.listProviders(),
      this.getSetting("defaultProviderId"),
    ]);
    return { providers, defaultProviderId: setting?.value || null };
  }

  async saveBranch(input) {
    const now = Date.now();
    const existing = input?.id ? await this.getBranch(input.id) : null;
    const selectedText = cleanText(input?.selectedText || existing?.selectedText, 500);
    if (!selectedText) throw new Error("Branch 缺少 selectedText。");
    const sourceUrl = cleanUrl(input?.sourceUrl || existing?.sourceUrl);
    const sessionId = cleanText(input?.sessionId || existing?.sessionId, 220) || `session-${crypto.randomUUID()}`;
    const status = BRANCH_STATUSES.has(input?.status) ? input.status : (existing?.status || "active");
    const branch = {
      id: cleanText(input?.id || existing?.id, 220) || crypto.randomUUID(),
      sessionId,
      parentId: cleanText(input?.parentId || existing?.parentId, 220) || null,
      selectedText,
      conceptKey: normalizeConcept(selectedText),
      sourceContext: cleanText(input?.sourceContext ?? input?.context ?? existing?.sourceContext, 7000),
      sourceTitle: cleanText(input?.sourceTitle || existing?.sourceTitle, 500),
      sourceUrl,
      anchor: input?.anchor || existing?.anchor || null,
      messages: normalizeMessages(input?.messages || existing?.messages),
      status,
      favorite: Boolean(input?.favorite ?? existing?.favorite ?? false),
      createdAt: Number(existing?.createdAt || input?.createdAt || now),
      updatedAt: now,
    };
    const session = {
      id: sessionId,
      title: branch.sourceTitle || branch.selectedText,
      sourceUrl,
      sourceTitle: branch.sourceTitle,
      createdAt: Number(input?.sessionCreatedAt || branch.createdAt),
      updatedAt: now,
    };
    await this.#transaction([STORE.SESSIONS, STORE.BRANCHES], "readwrite", async tx => {
      tx.objectStore(STORE.SESSIONS).put(session);
      tx.objectStore(STORE.BRANCHES).put(branch);
    });
    if (status === "understood" || status === "unclear") await this.#consolidateKnowledge(branch);
    return branch;
  }

  async getBranch(id) {
    if (!id) return null;
    return this.#transaction([STORE.BRANCHES], "readonly", async tx => {
      return requestValue(tx.objectStore(STORE.BRANCHES).get(id));
    });
  }

  async listBranches({ limit = 100, search = "", status = "", favorite } = {}) {
    const query = normalizeConcept(search);
    return this.#transaction([STORE.BRANCHES], "readonly", async tx => {
      const index = tx.objectStore(STORE.BRANCHES).index("updatedAt");
      const results = [];
      await new Promise((resolve, reject) => {
        const request = index.openCursor(null, "prev");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor || results.length >= limit) return resolve();
          const value = cursor.value;
          const matchesSearch = !query || value.conceptKey.includes(query)
            || normalizeConcept(value.sourceTitle).includes(query)
            || normalizeConcept(value.sourceContext).includes(query);
          const matchesFavorite = typeof favorite !== "boolean" || Boolean(value.favorite) === favorite;
          if (matchesSearch && matchesFavorite && (!status || value.status === status)) results.push(value);
          cursor.continue();
        };
      });
      return results;
    });
  }

  async updateBranchStatus(id, status) {
    if (!BRANCH_STATUSES.has(status)) throw new Error("无效的 Branch 状态。");
    const branch = await this.getBranch(id);
    if (!branch) throw new Error("Branch 不存在。");
    return this.saveBranch({ ...branch, status });
  }

  async setBranchFavorite(id, favorite) {
    const branch = await this.getBranch(id);
    if (!branch) throw new Error("Branch 不存在。");
    return this.saveBranch({ ...branch, favorite: Boolean(favorite) });
  }

  async #consolidateKnowledge(branch) {
    const now = Date.now();
    const existing = await this.#transaction([STORE.KNOWLEDGE], "readonly", async tx => {
      return requestValue(tx.objectStore(STORE.KNOWLEDGE).index("conceptKey").get(branch.conceptKey));
    });
    const knowledge = deriveKnowledge(existing, branch, now);
    await this.#transaction([STORE.KNOWLEDGE], "readwrite", async tx => {
      tx.objectStore(STORE.KNOWLEDGE).put(knowledge);
    });

    if (branch.status === "unclear") {
      await this.#upsertWeakness(knowledge, "user_marked_unclear", branch.id, now);
    } else {
      await this.#resolveWeakness(knowledge.id, "user_marked_unclear", now);
    }
    if (knowledge.askCount >= 3) {
      await this.#upsertWeakness(knowledge, "repeated_question", branch.id, now);
    }
    return knowledge;
  }

  async #resolveWeakness(knowledgeId, reason, now) {
    const id = `${knowledgeId}:${reason}`;
    await this.#transaction([STORE.WEAKNESSES], "readwrite", async tx => {
      const store = tx.objectStore(STORE.WEAKNESSES);
      const existing = await requestValue(store.get(id));
      if (existing) store.put({ ...existing, resolved: true, resolvedAt: now });
    });
  }

  async #upsertWeakness(knowledge, reason, branchId, now) {
    const id = `${knowledge.id}:${reason}`;
    await this.#transaction([STORE.WEAKNESSES], "readwrite", async tx => {
      const store = tx.objectStore(STORE.WEAKNESSES);
      const existing = await requestValue(store.get(id));
      store.put(deriveWeakness(existing, knowledge, reason, branchId, now));
    });
  }

  async listKnowledge({ limit = 200, search = "", status = "" } = {}) {
    const query = normalizeConcept(search);
    return this.#transaction([STORE.KNOWLEDGE], "readonly", async tx => {
      const values = await requestValue(tx.objectStore(STORE.KNOWLEDGE).getAll());
      return values
        .filter(item => (!query || item.conceptKey.includes(query) || item.tags?.some(tag => normalizeConcept(tag).includes(query)))
          && (!status || item.status === status))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit);
    });
  }

  async listWeaknesses({ limit = 200, unresolvedOnly = true } = {}) {
    return this.#transaction([STORE.WEAKNESSES, STORE.KNOWLEDGE], "readonly", async tx => {
      const weaknesses = await requestValue(tx.objectStore(STORE.WEAKNESSES).getAll());
      const knowledgeStore = tx.objectStore(STORE.KNOWLEDGE);
      const items = [];
      for (const weakness of weaknesses) {
        if (unresolvedOnly && weakness.resolved) continue;
        const knowledge = await requestValue(knowledgeStore.get(weakness.knowledgeId));
        if (knowledge) items.push({ ...weakness, knowledge });
      }
      return items.sort((a, b) => b.weight - a.weight || b.lastDetectedAt - a.lastDetectedAt).slice(0, limit);
    });
  }

  async getStats() {
    const [branches, knowledge, weaknesses, providers] = await Promise.all([
      this.listBranches({ limit: 10_000 }),
      this.listKnowledge({ limit: 10_000 }),
      this.listWeaknesses({ limit: 10_000 }),
      this.listProviders(),
    ]);
    return {
      branches: branches.length,
      understood: branches.filter(item => item.status === "understood").length,
      unclear: branches.filter(item => item.status === "unclear").length,
      favorites: branches.filter(item => item.favorite).length,
      knowledge: knowledge.length,
      weaknesses: weaknesses.length,
      providers: providers.length,
    };
  }
}

export const sideAskStorage = new SideAskStorage();
