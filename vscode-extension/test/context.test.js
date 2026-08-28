const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_SELECTION_CHARS,
  buildEditorSource,
  buildClipboardSource,
  cleanQuestion
} = require("../src/context");

function mockEditor(lines, selection, selectedText) {
  return {
    selection,
    document: {
      lineCount: lines.length,
      languageId: "javascript",
      fileName: "example.js",
      uri: { toString: () => "file:///example.js" },
      lineAt: line => ({ text: lines[line] }),
      getText: () => selectedText
    }
  };
}

test("buildEditorSource keeps the selection and bounded nearby lines", () => {
  const lines = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`);
  const editor = mockEditor(lines, {
    start: { line: 8, character: 0 },
    end: { line: 9, character: 7 }
  }, "line 9\nline 10");
  const source = buildEditorSource(editor, {
    surroundingLines: 2,
    asRelativePath: () => "src/example.js"
  });

  assert.equal(source.selectedText, "line 9\nline 10");
  assert.equal(source.context, lines.slice(6, 12).join("\n"));
  assert.equal(source.sourceTitle, "src/example.js:L9–10");
  assert.equal(source.nearbyLines, 6);
  assert.equal(source.languageId, "javascript");
});

test("buildClipboardSource rejects empty text and truncates oversized input", () => {
  assert.equal(buildClipboardSource("   ", "en"), null);
  const source = buildClipboardSource("x".repeat(MAX_SELECTION_CHARS + 50), "zh-CN");
  assert.equal(source.selectedText.length, MAX_SELECTION_CHARS);
  assert.equal(source.sourceTitle, "VS Code 剪贴板");
});

test("cleanQuestion trims and removes null characters", () => {
  assert.equal(cleanQuestion("  why\0?  "), "why?");
});
