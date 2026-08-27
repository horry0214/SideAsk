import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = fs.readFileSync(path.join(root, "extension/i18n.js"), "utf8");
const stored = new Map();
const sandbox = {
  navigator: { language: "en-US" },
  localStorage: {
    getItem: key => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, String(value)),
  },
};
vm.runInNewContext(source, sandbox, { filename: "extension/i18n.js" });
const i18n = sandbox.SideAskI18n;

test("locale normalization supports Chinese and English variants", () => {
  assert.equal(i18n.normalizeLocale("zh-Hans"), "zh-CN");
  assert.equal(i18n.normalizeLocale("en-GB"), "en");
  assert.equal(i18n.detectLocale(), "en");
});

test("translations interpolate values and fall back safely", () => {
  assert.equal(i18n.t("en", "knowledge.asks", { count: 3 }), "Asked 3 times");
  assert.equal(i18n.t("zh-CN", "knowledge.asks", { count: 3 }), "提问 3 次");
  assert.equal(i18n.t("en", "missing.key"), "missing.key");
});

test("the preview locale persists without an extension runtime", async () => {
  await i18n.saveLocale("zh-TW");
  assert.equal(await i18n.loadLocale(), "zh-CN");
  await i18n.saveLocale("en-US");
  assert.equal(await i18n.loadLocale(), "en");
});
