(() => {
  function safeLink(value) {
    try {
      const url = new URL(String(value || "").trim());
      return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function appendInline(parent, value) {
    const source = String(value || "");
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_([^_]|_(?!_))+_|\[[^\]]+\]\([^\s)]+\))/g;
    let cursor = 0;
    for (const match of source.matchAll(pattern)) {
      if (match.index > cursor) parent.appendChild(document.createTextNode(source.slice(cursor, match.index)));
      const token = match[0];
      if (token.startsWith("`")) {
        const code = document.createElement("code");
        code.textContent = token.slice(1, -1);
        parent.appendChild(code);
      } else if (token.startsWith("**") || token.startsWith("__")) {
        const strong = document.createElement("strong");
        appendInline(strong, token.slice(2, -2));
        parent.appendChild(strong);
      } else if (token.startsWith("*") || token.startsWith("_")) {
        const emphasis = document.createElement("em");
        appendInline(emphasis, token.slice(1, -1));
        parent.appendChild(emphasis);
      } else {
        const parts = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        const href = safeLink(parts?.[2]);
        if (href) {
          const link = document.createElement("a");
          link.href = href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          appendInline(link, parts[1]);
          parent.appendChild(link);
        } else {
          parent.appendChild(document.createTextNode(parts?.[1] || token));
        }
      }
      cursor = match.index + token.length;
    }
    if (cursor < source.length) parent.appendChild(document.createTextNode(source.slice(cursor)));
  }

  function splitTableRow(line) {
    let value = String(line || "").trim();
    if (value.startsWith("|")) value = value.slice(1);
    if (value.endsWith("|")) value = value.slice(0, -1);
    return value.split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, "|"));
  }

  function tableAlignment(value) {
    const cell = String(value || "").replace(/\s/g, "");
    if (!/^:?-{3,}:?$/.test(cell)) return null;
    if (cell.startsWith(":") && cell.endsWith(":")) return "center";
    return cell.endsWith(":") ? "right" : "left";
  }

  function renderMarkdown(value) {
    const fragment = document.createDocumentFragment();
    const lines = String(value || "").replace(/\r\n?/g, "\n").replace(/\0/g, "").split("\n");
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      const fence = line.match(/^ {0,3}```\s*([\w.+-]*)\s*$/);
      if (fence) {
        const values = [];
        index += 1;
        while (index < lines.length && !/^ {0,3}```\s*$/.test(lines[index])) values.push(lines[index++]);
        if (index < lines.length) index += 1;
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = values.join("\n");
        if (fence[1]) code.dataset.language = fence[1];
        pre.appendChild(code);
        fragment.appendChild(pre);
        continue;
      }

      const heading = line.match(/^ {0,3}(#{1,4})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        const element = document.createElement(`h${heading[1].length}`);
        appendInline(element, heading[2]);
        fragment.appendChild(element);
        index += 1;
        continue;
      }

      if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        fragment.appendChild(document.createElement("hr"));
        index += 1;
        continue;
      }

      if (index + 1 < lines.length && line.includes("|")) {
        const alignments = splitTableRow(lines[index + 1]).map(tableAlignment);
        if (alignments.length && alignments.every(Boolean)) {
          const headers = splitTableRow(line);
          const wrap = document.createElement("div");
          wrap.className = "md-table-wrap";
          const table = document.createElement("table");
          const thead = document.createElement("thead");
          const headerRow = document.createElement("tr");
          headers.forEach((header, column) => {
            const th = document.createElement("th");
            th.style.textAlign = alignments[column] || "left";
            appendInline(th, header);
            headerRow.appendChild(th);
          });
          thead.appendChild(headerRow);
          const tbody = document.createElement("tbody");
          index += 2;
          while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
            const values = splitTableRow(lines[index++]);
            const row = document.createElement("tr");
            headers.forEach((_header, column) => {
              const td = document.createElement("td");
              td.style.textAlign = alignments[column] || "left";
              appendInline(td, values[column] || "");
              row.appendChild(td);
            });
            tbody.appendChild(row);
          }
          table.append(thead, tbody);
          wrap.appendChild(table);
          fragment.appendChild(wrap);
          continue;
        }
      }

      if (/^ {0,3}>\s?/.test(line)) {
        const quote = document.createElement("blockquote");
        while (index < lines.length && /^ {0,3}>\s?/.test(lines[index])) {
          const paragraph = document.createElement("p");
          appendInline(paragraph, lines[index++].replace(/^ {0,3}>\s?/, ""));
          quote.appendChild(paragraph);
        }
        fragment.appendChild(quote);
        continue;
      }

      const listMatch = line.match(/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/);
      if (listMatch) {
        const ordered = /^\d/.test(listMatch[1]);
        const list = document.createElement(ordered ? "ol" : "ul");
        while (index < lines.length) {
          const item = lines[index].match(/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/);
          if (!item || /^\d/.test(item[1]) !== ordered) break;
          const li = document.createElement("li");
          appendInline(li, item[2]);
          list.appendChild(li);
          index += 1;
        }
        fragment.appendChild(list);
        continue;
      }

      const paragraphLines = [line.trim()];
      index += 1;
      while (index < lines.length && lines[index].trim()) {
        const next = lines[index];
        if (/^ {0,3}(?:```|#{1,4}\s|>\s?|[-+*]\s+|\d+[.)]\s+)/.test(next)) break;
        if (index + 1 < lines.length && next.includes("|") && splitTableRow(lines[index + 1]).map(tableAlignment).every(Boolean)) break;
        paragraphLines.push(next.trim());
        index += 1;
      }
      const paragraph = document.createElement("p");
      appendInline(paragraph, paragraphLines.join(" "));
      fragment.appendChild(paragraph);
    }
    return fragment;
  }

  globalThis.SideAskMarkdown = Object.freeze({ renderMarkdown, safeLink });
})();
