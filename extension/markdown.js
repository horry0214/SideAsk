(() => {
  function safeLink(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    try {
      const parsed = new URL(raw, "https://sideask.local/");
      if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) return null;
      return raw;
    } catch {
      return null;
    }
  }

  function findClosingParen(source, openIndex) {
    let depth = 0;
    for (let index = openIndex; index < source.length; index += 1) {
      if (source[index] === "\\") {
        index += 1;
        continue;
      }
      if (source[index] === "(") depth += 1;
      else if (source[index] === ")") {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return -1;
  }

  function parseInline(value) {
    const source = String(value || "");
    const tokens = [];
    let plain = "";

    const flush = () => {
      if (!plain) return;
      tokens.push({ type: "text", value: plain });
      plain = "";
    };

    for (let index = 0; index < source.length;) {
      if (source[index] === "\\" && index + 1 < source.length) {
        plain += source[index + 1];
        index += 2;
        continue;
      }

      if (source[index] === "`") {
        const end = source.indexOf("`", index + 1);
        if (end > index + 1) {
          flush();
          tokens.push({ type: "code", value: source.slice(index + 1, end) });
          index = end + 1;
          continue;
        }
      }

      const strongMarker = source.startsWith("**", index) ? "**" : (source.startsWith("__", index) ? "__" : null);
      if (strongMarker) {
        const end = source.indexOf(strongMarker, index + 2);
        if (end > index + 2) {
          flush();
          tokens.push({ type: "strong", children: parseInline(source.slice(index + 2, end)) });
          index = end + 2;
          continue;
        }
      }

      if (source[index] === "[" || (source[index] === "!" && source[index + 1] === "[")) {
        const image = source[index] === "!";
        const labelStart = index + (image ? 2 : 1);
        const labelEnd = source.indexOf("]", labelStart);
        if (labelEnd > labelStart && source[labelEnd + 1] === "(") {
          const urlEnd = findClosingParen(source, labelEnd + 1);
          if (urlEnd > labelEnd + 2) {
            const label = source.slice(labelStart, labelEnd);
            const href = safeLink(source.slice(labelEnd + 2, urlEnd));
            flush();
            if (image) {
              tokens.push({ type: "text", value: `图片：${label}` });
            } else if (href) {
              tokens.push({ type: "link", href, children: parseInline(label) });
            } else {
              tokens.push({ type: "text", value: label });
            }
            index = urlEnd + 1;
            continue;
          }
        }
      }

      const emphasisMarker = source[index] === "*" || source[index] === "_" ? source[index] : null;
      const previous = index > 0 ? source[index - 1] : "";
      const next = source[index + 1] || "";
      const allowedBoundary = emphasisMarker !== "_" || !(/[\p{L}\p{N}]/u.test(previous) && /[\p{L}\p{N}]/u.test(next));
      if (emphasisMarker && allowedBoundary) {
        const end = source.indexOf(emphasisMarker, index + 1);
        if (end > index + 1) {
          flush();
          tokens.push({ type: "emphasis", children: parseInline(source.slice(index + 1, end)) });
          index = end + 1;
          continue;
        }
      }

      if (source[index] === "\n") {
        flush();
        tokens.push({ type: "break" });
        index += 1;
        continue;
      }

      plain += source[index];
      index += 1;
    }

    flush();
    return tokens;
  }

  function splitTableRow(line) {
    let value = String(line || "").trim();
    if (value.startsWith("|")) value = value.slice(1);
    if (value.endsWith("|")) value = value.slice(0, -1);
    return value.split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, "|"));
  }

  function tableAlignment(cell) {
    const value = cell.replace(/\s/g, "");
    if (!/^:?-{3,}:?$/.test(value)) return null;
    if (value.startsWith(":") && value.endsWith(":")) return "center";
    if (value.endsWith(":")) return "right";
    return "left";
  }

  function isFence(line) {
    return /^ {0,3}```/.test(line);
  }

  function isList(line) {
    return /^ {0,3}(?:[-+*]|\d+[.)])\s+\S/.test(line);
  }

  function isBlockStart(lines, index) {
    const line = lines[index] || "";
    if (!line.trim()) return true;
    if (isFence(line) || /^ {0,3}#{1,4}\s+/.test(line) || /^ {0,3}>\s?/.test(line) || isList(line) || /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return true;
    if (index + 1 < lines.length && line.includes("|") && splitTableRow(lines[index + 1]).every(cell => tableAlignment(cell))) return true;
    return false;
  }

  function parseMarkdown(value) {
    const lines = String(value || "").replace(/\r\n?/g, "\n").replace(/\0/g, "").split("\n");
    const blocks = [];

    for (let index = 0; index < lines.length;) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      const fence = line.match(/^ {0,3}```\s*([\w.+-]*)\s*$/);
      if (fence) {
        const code = [];
        index += 1;
        while (index < lines.length && !/^ {0,3}```\s*$/.test(lines[index])) {
          code.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        blocks.push({ type: "code", language: fence[1] || "", value: code.join("\n") });
        continue;
      }

      const heading = line.match(/^ {0,3}(#{1,4})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        blocks.push({ type: "heading", level: heading[1].length, content: heading[2] });
        index += 1;
        continue;
      }

      if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        blocks.push({ type: "rule" });
        index += 1;
        continue;
      }

      if (index + 1 < lines.length && line.includes("|")) {
        const alignments = splitTableRow(lines[index + 1]).map(tableAlignment);
        if (alignments.length && alignments.every(Boolean)) {
          const headers = splitTableRow(line);
          const rows = [];
          index += 2;
          while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
            rows.push(splitTableRow(lines[index]));
            index += 1;
          }
          blocks.push({ type: "table", headers, alignments, rows });
          continue;
        }
      }

      if (/^ {0,3}>\s?/.test(line)) {
        const quote = [];
        while (index < lines.length && /^ {0,3}>\s?/.test(lines[index])) {
          quote.push(lines[index].replace(/^ {0,3}>\s?/, ""));
          index += 1;
        }
        blocks.push({ type: "quote", blocks: parseMarkdown(quote.join("\n")) });
        continue;
      }

      const list = line.match(/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/);
      if (list) {
        const ordered = /^\d/.test(list[1]);
        const items = [];
        while (index < lines.length) {
          const item = lines[index].match(/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/);
          if (!item || /^\d/.test(item[1]) !== ordered) break;
          items.push(item[2]);
          index += 1;
        }
        blocks.push({ type: "list", ordered, items });
        continue;
      }

      const paragraph = [line.trim()];
      index += 1;
      while (index < lines.length && !isBlockStart(lines, index)) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      blocks.push({ type: "paragraph", content: paragraph.join(" ") });
    }

    return blocks;
  }

  function appendInlineTokens(parent, tokens, documentRef) {
    for (const token of tokens) {
      if (token.type === "text") parent.appendChild(documentRef.createTextNode(token.value));
      else if (token.type === "break") parent.appendChild(documentRef.createElement("br"));
      else if (token.type === "code") {
        const code = documentRef.createElement("code");
        code.textContent = token.value;
        parent.appendChild(code);
      } else if (token.type === "strong" || token.type === "emphasis") {
        const element = documentRef.createElement(token.type === "strong" ? "strong" : "em");
        appendInlineTokens(element, token.children, documentRef);
        parent.appendChild(element);
      } else if (token.type === "link") {
        const link = documentRef.createElement("a");
        link.href = token.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        appendInlineTokens(link, token.children, documentRef);
        parent.appendChild(link);
      }
    }
  }

  function appendInline(parent, value, documentRef) {
    appendInlineTokens(parent, parseInline(value), documentRef);
  }

  function appendBlocks(parent, blocks, documentRef) {
    for (const block of blocks) {
      if (block.type === "heading") {
        const heading = documentRef.createElement(`h${block.level}`);
        appendInline(heading, block.content, documentRef);
        parent.appendChild(heading);
      } else if (block.type === "paragraph") {
        const paragraph = documentRef.createElement("p");
        appendInline(paragraph, block.content, documentRef);
        parent.appendChild(paragraph);
      } else if (block.type === "code") {
        const pre = documentRef.createElement("pre");
        const code = documentRef.createElement("code");
        if (block.language) code.dataset.language = block.language;
        code.textContent = block.value;
        pre.appendChild(code);
        parent.appendChild(pre);
      } else if (block.type === "rule") {
        parent.appendChild(documentRef.createElement("hr"));
      } else if (block.type === "quote") {
        const quote = documentRef.createElement("blockquote");
        appendBlocks(quote, block.blocks, documentRef);
        parent.appendChild(quote);
      } else if (block.type === "list") {
        const list = documentRef.createElement(block.ordered ? "ol" : "ul");
        for (const value of block.items) {
          const item = documentRef.createElement("li");
          appendInline(item, value, documentRef);
          list.appendChild(item);
        }
        parent.appendChild(list);
      } else if (block.type === "table") {
        const wrap = documentRef.createElement("div");
        wrap.className = "sideask-md-table-wrap";
        const table = documentRef.createElement("table");
        const head = documentRef.createElement("thead");
        const headRow = documentRef.createElement("tr");
        block.headers.forEach((value, column) => {
          const cell = documentRef.createElement("th");
          cell.style.textAlign = block.alignments[column] || "left";
          appendInline(cell, value, documentRef);
          headRow.appendChild(cell);
        });
        head.appendChild(headRow);
        const body = documentRef.createElement("tbody");
        block.rows.forEach(values => {
          const row = documentRef.createElement("tr");
          block.headers.forEach((_header, column) => {
            const cell = documentRef.createElement("td");
            cell.style.textAlign = block.alignments[column] || "left";
            appendInline(cell, values[column] || "", documentRef);
            row.appendChild(cell);
          });
          body.appendChild(row);
        });
        table.append(head, body);
        wrap.appendChild(table);
        parent.appendChild(wrap);
      }
    }
  }

  function renderMarkdown(value, documentRef = document) {
    const fragment = documentRef.createDocumentFragment();
    appendBlocks(fragment, parseMarkdown(value), documentRef);
    return fragment;
  }

  globalThis.SideAskMarkdown = Object.freeze({ parseInline, parseMarkdown, renderMarkdown, safeLink });
})();
