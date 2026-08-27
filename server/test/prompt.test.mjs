import assert from "node:assert/strict";
import test from "node:test";
import { systemPrompt } from "../prompt.mjs";

const payload = {
  selection: "phi node",
  context: "A control-flow merge selects a predecessor value.",
  sourceTitle: "LLVM Language Reference",
  sourceUrl: "https://llvm.org/docs/LangRef.html",
};

test("English UI requests an English context-aware system prompt", () => {
  const prompt = systemPrompt({ ...payload, locale: "en" });
  assert.match(prompt, /Answer in English/);
  assert.match(prompt, /Selected text: phi node/);
  assert.match(prompt, /LLVM Language Reference/);
});

test("Chinese remains the default prompt language", () => {
  const prompt = systemPrompt(payload);
  assert.match(prompt, /默认使用中文/);
  assert.match(prompt, /用户选中的内容：phi node/);
});
