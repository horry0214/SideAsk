const MAX_SELECTION_CHARS = 12_000;
const MAX_CONTEXT_CHARS = 18_000;
const MAX_QUESTION_CHARS = 4_000;

function cleanText(value, limit) {
  const normalized = String(value || "").replace(/\r\n?/g, "\n").replace(/\0/g, "").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1))}…`;
}

function buildEditorSource(editor, options = {}) {
  if (!editor?.document || !editor.selection) return null;
  const selectedText = cleanText(editor.document.getText(editor.selection), MAX_SELECTION_CHARS);
  if (!selectedText) return null;

  const surroundingLines = Math.max(0, Math.min(50, Number(options.surroundingLines) || 0));
  const firstLine = Math.max(0, editor.selection.start.line - surroundingLines);
  const lastLine = Math.min(editor.document.lineCount - 1, editor.selection.end.line + surroundingLines);
  const nearbyText = [];
  for (let line = firstLine; line <= lastLine; line += 1) {
    nearbyText.push(editor.document.lineAt(line).text);
  }
  const relativePath = typeof options.asRelativePath === "function"
    ? options.asRelativePath(editor.document.uri)
    : editor.document.fileName || editor.document.uri?.path || "Untitled";
  const lineLabel = editor.selection.start.line === editor.selection.end.line
    ? `L${editor.selection.start.line + 1}`
    : `L${editor.selection.start.line + 1}–${editor.selection.end.line + 1}`;

  return {
    kind: "editor",
    selectedText,
    context: cleanText(nearbyText.join("\n"), MAX_CONTEXT_CHARS),
    sourceTitle: `${relativePath}:${lineLabel}`,
    sourceUri: editor.document.uri?.toString?.() || "",
    languageId: editor.document.languageId || "text",
    range: {
      start: {
        line: editor.selection.start.line,
        character: editor.selection.start.character
      },
      end: {
        line: editor.selection.end.line,
        character: editor.selection.end.character
      }
    },
    nearbyLines: lastLine - firstLine + 1
  };
}

function buildClipboardSource(value, locale = "en") {
  const selectedText = cleanText(value, MAX_SELECTION_CHARS);
  if (!selectedText) return null;
  return {
    kind: "clipboard",
    selectedText,
    context: "",
    sourceTitle: locale === "zh-CN" ? "VS Code 剪贴板" : "VS Code clipboard",
    sourceUri: "",
    languageId: "text",
    range: null,
    nearbyLines: 0
  };
}

function cleanQuestion(value) {
  return cleanText(value, MAX_QUESTION_CHARS);
}

module.exports = {
  MAX_SELECTION_CHARS,
  MAX_CONTEXT_CHARS,
  MAX_QUESTION_CHARS,
  buildEditorSource,
  buildClipboardSource,
  cleanQuestion,
  cleanText
};
