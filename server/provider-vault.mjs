import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ProviderError, ProviderErrorCode } from "./providers/index.mjs";

const VAULT_VERSION = 1;
const KEY_BYTES = 32;
const IV_BYTES = 12;

function cleanText(value, maxLength) {
  return String(value || "").replace(/\0/g, "").trim().slice(0, maxLength);
}

function cleanId(value) {
  const id = cleanText(value, 200);
  return /^[A-Za-z0-9._-]{1,200}$/.test(id) ? id : "";
}

function invalidProvider(providerId, message = "Provider 配置无效。") {
  return new ProviderError(ProviderErrorCode.INVALID_PROVIDER_CONFIG, {
    providerId: providerId || "missing",
    message,
  });
}

export function defaultSideAskDataDirectory(env = process.env, platform = process.platform, homeDirectory = os.homedir()) {
  if (env.SIDEASK_DATA_DIR) return path.resolve(env.SIDEASK_DATA_DIR);
  if (platform === "win32") return path.resolve(env.APPDATA || path.join(homeDirectory, "AppData", "Roaming"), "SideAsk");
  if (platform === "darwin") return path.resolve(homeDirectory, "Library", "Application Support", "SideAsk");
  return path.resolve(env.XDG_CONFIG_HOME || path.join(homeDirectory, ".config"), "sideask");
}

export class ProviderVault {
  constructor({ registry, directory = defaultSideAskDataDirectory() } = {}) {
    if (!registry) throw new TypeError("ProviderVault requires a Provider Registry.");
    this.registry = registry;
    this.directory = path.resolve(directory);
    this.vaultPath = path.join(this.directory, "provider-vault.json");
    this.keyPath = path.join(this.directory, ".provider-vault-key");
    this.key = null;
    this.state = this.#readState();
  }

  #ensureDirectory() {
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(this.directory, 0o700); } catch (_) {}
  }

  #readState() {
    this.#ensureDirectory();
    if (!fs.existsSync(this.vaultPath)) {
      return { version: VAULT_VERSION, defaultProviderId: null, providers: [] };
    }
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(this.vaultPath, "utf8"));
    } catch (error) {
      throw new Error(`SideAsk Provider Vault 无法读取：${error.message}`);
    }
    if (parsed?.version !== VAULT_VERSION || !Array.isArray(parsed.providers)) {
      throw new Error("SideAsk Provider Vault 版本无效。");
    }
    const providers = parsed.providers.filter(item => item && cleanId(item.id) && cleanId(item.type));
    const defaultProviderId = providers.some(item => item.id === parsed.defaultProviderId)
      ? parsed.defaultProviderId
      : (providers[0]?.id || null);
    return { version: VAULT_VERSION, defaultProviderId, providers };
  }

  #loadKey() {
    if (this.key) return this.key;
    this.#ensureDirectory();
    if (!fs.existsSync(this.keyPath)) {
      const generated = crypto.randomBytes(KEY_BYTES);
      try {
        fs.writeFileSync(this.keyPath, generated.toString("base64"), { encoding: "utf8", flag: "wx", mode: 0o600 });
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }
    }
    const value = Buffer.from(fs.readFileSync(this.keyPath, "utf8").trim(), "base64");
    if (value.length !== KEY_BYTES) throw new Error("SideAsk Provider Vault 密钥无效。");
    try { fs.chmodSync(this.keyPath, 0o600); } catch (_) {}
    this.key = value;
    return value;
  }

  #encrypt(value) {
    const plaintext = cleanText(value, 10_000);
    if (!plaintext) return null;
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.#loadKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return {
      version: 1,
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  }

  #decrypt(encrypted) {
    if (!encrypted) return "";
    if (encrypted.version !== 1 || encrypted.algorithm !== "aes-256-gcm") {
      throw new Error("SideAsk Provider Vault 中的密钥格式无效。");
    }
    try {
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        this.#loadKey(),
        Buffer.from(encrypted.iv, "base64"),
      );
      decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new Error("SideAsk Provider Vault 解密失败，文件可能已损坏或密钥不匹配。");
    }
  }

  #writeState() {
    this.#ensureDirectory();
    const temporaryPath = `${this.vaultPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    try {
      fs.renameSync(temporaryPath, this.vaultPath);
      try { fs.chmodSync(this.vaultPath, 0o600); } catch (_) {}
    } finally {
      if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
    }
  }

  #storedProvider(id) {
    return this.state.providers.find(item => item.id === id) || null;
  }

  #publicProvider(record) {
    return {
      id: record.id,
      type: record.type,
      displayName: record.displayName,
      baseUrl: record.baseUrl,
      model: record.model,
      apiKeyConfigured: Boolean(record.apiKey),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  listState() {
    return {
      version: VAULT_VERSION,
      storage: "local-encrypted-vault",
      providers: [...this.state.providers]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(item => this.#publicProvider(item)),
      defaultProviderId: this.state.defaultProviderId,
    };
  }

  getProvider(id) {
    const record = this.#storedProvider(cleanId(id));
    if (!record) return null;
    return { ...this.#publicProvider(record), apiKey: this.#decrypt(record.apiKey) };
  }

  saveProvider(input = {}) {
    const requestedId = cleanId(input.id);
    const existing = requestedId ? this.#storedProvider(requestedId) : null;
    const type = cleanId(input.type || existing?.type);
    if (!type) throw invalidProvider(type, "请选择 Provider 类型。");
    if (existing && type !== existing.type) throw invalidProvider(type, "已保存 Provider 的类型不能直接修改。");
    const provider = this.registry.get(type);
    const existingKey = existing ? this.#decrypt(existing.apiKey) : "";
    const apiKey = cleanText(input.apiKey, 10_000) || existingKey;
    const clientConfig = provider.resolveClientConfig({
      displayName: cleanText(input.displayName || existing?.displayName || provider.displayName, 120),
      baseUrl: cleanText(input.baseUrl || existing?.baseUrl, 2_000),
      model: cleanText(input.model || existing?.model, 300),
      apiKey,
    });
    const validation = provider.validateConfig(clientConfig);
    if (!validation.ok) {
      throw invalidProvider(type, `Provider 配置缺少或包含无效字段：${validation.issues.join(", ")}。`);
    }

    const now = Date.now();
    const record = {
      id: existing?.id || requestedId || crypto.randomUUID(),
      type,
      displayName: clientConfig.displayName || provider.displayName,
      baseUrl: clientConfig.baseUrl,
      model: clientConfig.model,
      apiKey: this.#encrypt(clientConfig.apiKey),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    if (existing) this.state.providers[this.state.providers.indexOf(existing)] = record;
    else this.state.providers.push(record);
    if (!this.state.defaultProviderId) this.state.defaultProviderId = record.id;
    this.#writeState();
    return this.#publicProvider(record);
  }

  deleteProvider(id) {
    const providerId = cleanId(id);
    const index = this.state.providers.findIndex(item => item.id === providerId);
    if (index < 0) return false;
    this.state.providers.splice(index, 1);
    if (this.state.defaultProviderId === providerId) {
      this.state.defaultProviderId = this.state.providers[0]?.id || null;
    }
    this.#writeState();
    return true;
  }

  setDefaultProvider(id) {
    const providerId = cleanId(id);
    if (!this.#storedProvider(providerId)) throw invalidProvider(providerId, "Provider 不存在。");
    this.state.defaultProviderId = providerId;
    this.#writeState();
    return providerId;
  }

  resolveRuntime(id = this.state.defaultProviderId) {
    const record = this.#storedProvider(cleanId(id));
    if (!record) return null;
    const provider = this.registry.get(record.type);
    return {
      provider,
      config: provider.resolveClientConfig({
        displayName: record.displayName,
        baseUrl: record.baseUrl,
        model: record.model,
        apiKey: this.#decrypt(record.apiKey),
      }),
      registry: this.registry,
      providerId: record.id,
    };
  }
}
