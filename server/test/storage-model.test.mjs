import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveKnowledge,
  deriveWeakness,
  legacySessionToRecords,
  normalizeConcept,
  normalizeMessages,
} from "../../extension/storage.js";

test("concept normalization is stable for repeated questions", () => {
  assert.equal(normalizeConcept("  Phi   Node  "), "phi node");
  assert.equal(normalizeConcept("SSA"), "ssa");
});

test("legacy history becomes a LearningSession and LearningBranch without query secrets", () => {
  const { session, branch } = legacySessionToRecords({
    id: "old-1",
    selectedText: "SSA",
    context: "LLVM context",
    sourceTitle: "LLVM",
    sourceUrl: "https://example.test/doc?token=secret#part",
    understood: true,
    updatedAt: 100,
    anchor: { createdAt: 90 },
    messages: [{ role: "assistant", content: "answer" }],
  }, 200);
  assert.equal(session.sourceUrl, "https://example.test/doc");
  assert.equal(branch.status, "understood");
  assert.equal(branch.selectedText, "SSA");
  assert.equal(branch.messages.length, 1);
  assert.equal(branch.favorite, false);
});

test("message normalization drops unknown roles and bounds history", () => {
  const messages = Array.from({ length: 45 }, (_, index) => ({ role: index % 2 ? "user" : "assistant", content: String(index) }));
  messages.push({ role: "system", content: "hidden" });
  const normalized = normalizeMessages(messages);
  assert.equal(normalized.length, 40);
  assert.equal(normalized.some(item => item.role === "system"), false);
});

test("knowledge is derived from evidence and tracks repeated branches", () => {
  const first = deriveKnowledge(null, {
    id: "branch-1",
    selectedText: "SSA",
    sourceUrl: "https://example.test/llvm",
    status: "understood",
    createdAt: 10,
    messages: [{ role: "assistant", content: "Static Single Assignment." }],
  }, 20);
  const second = deriveKnowledge(first, {
    id: "branch-2",
    selectedText: "SSA",
    sourceUrl: "https://example.test/compiler",
    status: "unclear",
    createdAt: 30,
    messages: [{ role: "assistant", content: "A second explanation." }],
  }, 40);
  assert.equal(second.askCount, 2);
  assert.equal(second.status, "weak");
  assert.deepEqual(second.sourceBranches, ["branch-1", "branch-2"]);
  assert.equal(second.explanation, "A second explanation.");
});

test("weakness weight is based on distinct branch evidence", () => {
  const knowledge = { id: "knowledge-1", askCount: 3 };
  const first = deriveWeakness(null, knowledge, "user_marked_unclear", "branch-1", 10);
  const sameBranch = deriveWeakness(first, knowledge, "user_marked_unclear", "branch-1", 20);
  const secondBranch = deriveWeakness(sameBranch, knowledge, "user_marked_unclear", "branch-2", 30);
  assert.equal(sameBranch.weight, 1);
  assert.equal(secondBranch.weight, 2);
  assert.deepEqual(secondBranch.evidenceBranches, ["branch-1", "branch-2"]);
});
