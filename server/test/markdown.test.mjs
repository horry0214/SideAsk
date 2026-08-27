import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = fs.readFileSync(path.join(root, "extension/markdown.js"), "utf8");
const sandbox = { URL };
vm.runInNewContext(source, sandbox);
const { parseInline, parseMarkdown, safeLink } = sandbox.SideAskMarkdown;

test("Markdown block parser supports headings, lists, tables, quotes, and fenced code", () => {
  const blocks = parseMarkdown(`# 标题

- 第一项
- 第二项

| 名称 | 状态 |
| --- | :---: |
| SideAsk | MVP |

> 保持主线

\`\`\`js
const answer = 42;
\`\`\``);
  assert.deepEqual(Array.from(blocks, block => block.type), ["heading", "list", "table", "quote", "code"]);
  assert.equal(blocks[2].alignments[1], "center");
  assert.equal(blocks[4].language, "js");
});

test("Markdown inline parser recognizes emphasis, strong text, code, and safe links", () => {
  const tokens = parseInline("这是 **重点**、*强调*、`code` 和 [文档](https://example.com)。");
  assert.deepEqual(Array.from(tokens, token => token.type), ["text", "strong", "text", "emphasis", "text", "code", "text", "link", "text"]);
});

test("unsafe Markdown links are downgraded to text", () => {
  assert.equal(safeLink("javascript:alert(1)"), null);
  assert.equal(safeLink("data:text/html,test"), null);
  assert.equal(safeLink("https://example.com/docs"), "https://example.com/docs");
  const tokens = parseInline("[不要执行](javascript:alert(1))");
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].type, "text");
  assert.equal(tokens[0].value, "不要执行");
});

test("raw HTML stays literal text instead of becoming an executable node", () => {
  const blocks = parseMarkdown("<img src=x onerror=alert(1)> **安全文本**");
  assert.equal(blocks[0].type, "paragraph");
  const tokens = parseInline(blocks[0].content);
  assert.equal(tokens[0].type, "text");
  assert.match(tokens[0].value, /<img src=x onerror=alert\(1\)>/);
});

test("unfinished fenced code remains renderable while streaming", () => {
  const blocks = parseMarkdown("```python\nprint('streaming')");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "code");
  assert.equal(blocks[0].language, "python");
  assert.equal(blocks[0].value, "print('streaming')");
});
