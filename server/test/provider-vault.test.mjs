import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ProviderVault, defaultSideAskDataDirectory } from "../provider-vault.mjs";
import { createProviderRegistry } from "../providers/index.mjs";

function temporaryVault(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sideask-vault-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, vault: new ProviderVault({ registry: createProviderRegistry(), directory }) };
}

test("Provider Vault encrypts API keys and only exposes redacted state", t => {
  const { directory, vault } = temporaryVault(t);
  const saved = vault.saveProvider({
    id: "openai-main",
    type: "openai",
    displayName: "OpenAI Main",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.6-luna",
    apiKey: "test-secret-key",
  });

  assert.equal(saved.apiKeyConfigured, true);
  assert.equal("apiKey" in saved, false);
  assert.equal(vault.listState().providers[0].apiKeyConfigured, true);
  assert.equal(fs.readFileSync(path.join(directory, "provider-vault.json"), "utf8").includes("test-secret-key"), false);
  assert.equal(fs.readFileSync(path.join(directory, ".provider-vault-key"), "utf8").includes("test-secret-key"), false);
});

test("Provider Vault survives reload, preserves a blank edit key, and resolves runtime", t => {
  const { directory, vault } = temporaryVault(t);
  vault.saveProvider({
    id: "anthropic-main",
    type: "anthropic",
    displayName: "Claude",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-5",
    apiKey: "anthropic-secret",
  });
  const reloaded = new ProviderVault({ registry: createProviderRegistry(), directory });
  reloaded.saveProvider({ id: "anthropic-main", type: "anthropic", model: "claude-opus-5", apiKey: "" });
  const runtime = reloaded.resolveRuntime();

  assert.equal(runtime.provider.id, "anthropic");
  assert.equal(runtime.providerId, "anthropic-main");
  assert.equal(runtime.config.model, "claude-opus-5");
  assert.equal(runtime.config.apiKey, "anthropic-secret");
});

test("Provider Vault shares one default and moves it after deletion", t => {
  const { vault } = temporaryVault(t);
  vault.saveProvider({ id: "local-a", type: "ollama", model: "qwen3:8b" });
  vault.saveProvider({ id: "local-b", type: "lm-studio", model: "local-model" });
  vault.setDefaultProvider("local-b");
  assert.equal(vault.listState().defaultProviderId, "local-b");
  vault.deleteProvider("local-b");
  assert.equal(vault.listState().defaultProviderId, "local-a");
});

test("Provider Vault rejects insecure or incomplete provider records", t => {
  const { vault } = temporaryVault(t);
  assert.throws(() => vault.saveProvider({ type: "openai", model: "gpt", apiKey: "key", baseUrl: "http://example.com/v1" }));
  assert.throws(() => vault.saveProvider({ type: "openai", model: "gpt", baseUrl: "https://api.openai.com/v1" }));
});

test("SideAsk data directory follows an explicit override", () => {
  const directory = defaultSideAskDataDirectory({ SIDEASK_DATA_DIR: "./custom-sideask-data" }, "linux", "/tmp/home");
  assert.equal(directory, path.resolve("./custom-sideask-data"));
});
