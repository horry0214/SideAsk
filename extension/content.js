(() => {
  if (window.__SIDEASK_MVP_LOADED__) return;
  window.__SIDEASK_MVP_LOADED__ = true;

  const state = {
    selectedText: "",
    context: "",
    sourceTitle: document.title,
    anchor: null,
    liveRange: null,
    messages: [],
    streaming: false,
    status: "active",
    branchId: null,
    sessionId: `session-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
    historyMode: false,
    returnFocus: null,
  };

  const brandMarkUrl = chrome.runtime.getURL("assets/icons/sideask-mark.svg");
  const brandImage = () => {
    const image = document.createElement("img");
    image.src = brandMarkUrl;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    return image;
  };

  const bubble = document.createElement("button");
  bubble.id = "sideask-bubble";
  bubble.type = "button";
  bubble.setAttribute("aria-label", "用 SideAsk 解释选中的内容");
  bubble.innerHTML = '<span aria-hidden="true">✦</span><span>解释</span>';
  document.documentElement.appendChild(bubble);

  const statusDot = document.createElement("button");
  statusDot.id = "sideask-status-dot";
  statusDot.type = "button";
  statusDot.appendChild(brandImage());
  statusDot.title = "SideAsk 已在当前页面运行。点击打开。";
  statusDot.setAttribute("aria-label", "打开 SideAsk");
  document.documentElement.appendChild(statusDot);

  const panel = document.createElement("div");
  panel.id = "sideask-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-label", "SideAsk 支线提问");
  panel.setAttribute("aria-hidden", "true");
  panel.tabIndex = -1;
  panel.innerHTML = `
    <div class="sideask-header">
      <div class="sideask-logo" aria-hidden="true"><img src="${brandMarkUrl}" alt=""></div>
      <div class="sideask-title-wrap">
        <div class="sideask-title">SideAsk</div>
        <div class="sideask-subtitle">问题走支线，思路留主线</div>
      </div>
      <button class="sideask-icon-btn" id="sideask-dashboard-btn" title="打开 SideAsk 管理页" aria-label="打开 SideAsk 管理页">⌂</button>
      <button class="sideask-icon-btn" id="sideask-history-btn" title="历史支线" aria-label="查看历史支线">☰</button>
      <button class="sideask-icon-btn" id="sideask-min-btn" title="收起" aria-label="收起 SideAsk">—</button>
      <button class="sideask-icon-btn" id="sideask-close-btn" title="关闭" aria-label="关闭 SideAsk">×</button>
    </div>
    <div class="sideask-context" id="sideask-context-card">
      <div class="sideask-context-meta">
        <div class="sideask-context-label">你选中了</div>
        <div class="sideask-source" id="sideask-source"></div>
      </div>
      <div class="sideask-selection" id="sideask-selection"></div>
      <div class="sideask-actions">
        <button class="sideask-chip" data-action="simple">简单解释</button>
        <button class="sideask-chip" data-action="example">举个例子</button>
        <button class="sideask-chip" data-action="why">为什么重要</button>
        <button class="sideask-chip" data-action="deep">深入理解</button>
      </div>
    </div>
    <div class="sideask-body" id="sideask-body">
      <div class="sideask-empty">划词后点击「解释」，我会只带上附近必要上下文，帮助你处理支线问题而不离开当前页面。</div>
    </div>
    <div class="sideask-history" id="sideask-history"></div>
    <div class="sideask-footer" id="sideask-footer">
      <div class="sideask-input-row">
        <textarea class="sideask-input" id="sideask-input" rows="1" placeholder="继续追问…"></textarea>
        <button class="sideask-send" id="sideask-send" title="发送" aria-label="发送问题">↑</button>
      </div>
      <div class="sideask-bottom-actions">
        <div>
          <button class="sideask-link-btn sideask-understood" id="sideask-understood">✓ 我懂了</button>
          <button class="sideask-link-btn sideask-unclear" id="sideask-unclear">? 还模糊</button>
          <button class="sideask-link-btn" id="sideask-return">↩ 回到原文</button>
        </div>
        <span class="sideask-status" id="sideask-status">本地保存</span>
      </div>
    </div>
  `;
  document.documentElement.appendChild(panel);

  const $ = (sel) => panel.querySelector(sel);
  const bodyEl = $("#sideask-body");
  const historyEl = $("#sideask-history");
  const inputEl = $("#sideask-input");
  const sendEl = $("#sideask-send");
  const statusEl = $("#sideask-status");

  const SENSITIVE_SELECTOR = [
    "input",
    "textarea",
    "select",
    "option",
    "[contenteditable]:not([contenteditable='false'])",
    "[role='textbox']",
    "[data-private]",
    "[data-sensitive]",
    "[autocomplete='current-password']",
    "[autocomplete='new-password']",
    "script",
    "style",
    "noscript",
    "#sideask-panel",
    "#sideask-bubble",
    "#sideask-status-dot",
  ].join(",");

  function elementOf(node) {
    return node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  }

  function isSensitiveNode(node) {
    const element = elementOf(node);
    if (!element) return false;
    try {
      return Boolean(element.closest(SENSITIVE_SELECTOR));
    } catch {
      return true;
    }
  }

  function textOf(el) {
    if (!el || isSensitiveNode(el)) return "";
    const clone = el.cloneNode(true);
    clone.querySelectorAll?.(SENSITIVE_SELECTOR).forEach(node => node.remove());
    return (clone.textContent || "").replace(/\s+/g, " ").trim();
  }

  function limitText(text, max = 4200) {
    if (!text) return "";
    if (text.length <= max) return text;
    return `${text.slice(0, Math.floor(max * .62))}\n…\n${text.slice(-Math.floor(max * .38))}`;
  }

  function closestReadableBlock(node) {
    let el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (!el) return document.body;
    const preferred = el.closest("p, li, pre, blockquote, td, th, article, main");
    if (preferred && textOf(preferred).length < 7000) return preferred;
    for (let i = 0; i < 6 && el; i++, el = el.parentElement) {
      const t = textOf(el);
      if (t.length >= 80 && t.length <= 5000) return el;
    }
    return node?.parentElement || document.body;
  }

  function extractContext(range) {
    const block = closestReadableBlock(range.commonAncestorContainer);
    const pieces = [];
    const prev = block.previousElementSibling;
    const next = block.nextElementSibling;
    if (prev) pieces.push(textOf(prev).slice(-900));
    pieces.push(textOf(block));
    if (next) pieces.push(textOf(next).slice(0, 900));
    return limitText(pieces.filter(Boolean).join("\n\n"));
  }

  function cssPath(el) {
    if (!el || el === document.body) return "body";
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    for (let depth = 0; cur && cur !== document.body && depth < 6; depth++, cur = cur.parentElement) {
      let part = cur.tagName.toLowerCase();
      const parent = cur.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter(x => x.tagName === cur.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
    }
    return `body > ${parts.join(" > ")}`;
  }

  function buildAnchor(range, selectedText) {
    const block = closestReadableBlock(range.commonAncestorContainer);
    const blockText = textOf(block);
    const index = blockText.indexOf(selectedText);
    return {
      url: safeSourceUrl(),
      title: document.title,
      selectedText,
      prefix: index >= 0 ? blockText.slice(Math.max(0, index - 90), index) : "",
      suffix: index >= 0 ? blockText.slice(index + selectedText.length, index + selectedText.length + 90) : "",
      selector: cssPath(block),
      scrollY: window.scrollY,
      createdAt: Date.now(),
    };
  }

  function safeSourceUrl() {
    try {
      const url = new URL(location.href);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      return url.href;
    } catch {
      return `${location.origin || ""}${location.pathname || ""}`;
    }
  }

  function positionBubble(rect) {
    const width = 82;
    const left = Math.min(window.innerWidth - width - 10, Math.max(10, rect.left + rect.width / 2 - width / 2));
    const top = Math.min(window.innerHeight - 42, Math.max(8, rect.bottom + 8));
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.style.display = "flex";
  }

  function hideBubble() { bubble.style.display = "none"; }

  let selectionTimer = null;

  function captureSelection(event) {
    if (event && (panel.contains(event.target) || bubble.contains(event.target) || statusDot.contains(event.target))) return;
    clearTimeout(selectionTimer);
    // A tiny delay is more reliable on React-heavy pages such as ChatGPT/Claude.
    selectionTimer = setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() || "";
      if (!selection || selection.rangeCount === 0 || selectedText.length < 2 || selectedText.length > 500) {
        hideBubble();
        return;
      }

      const range = selection.getRangeAt(0).cloneRange();
      if (isSensitiveNode(range.commonAncestorContainer)) {
        hideBubble();
        return;
      }
      let rect = range.getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) {
        const rects = range.getClientRects();
        rect = rects && rects.length ? rects[rects.length - 1] : null;
      }
      if (!rect) {
        hideBubble();
        return;
      }

      state.selectedText = selectedText;
      state.context = extractContext(range);
      state.sourceTitle = document.title;
      state.anchor = buildAnchor(range, selectedText);
      state.liveRange = range;
      state.messages = [];
      state.status = "active";
      state.branchId = crypto.randomUUID?.() || `branch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      updateStatusControls();
      positionBubble(rect);
    }, 35);
  }

  // Mouse, stylus/touch and keyboard selection are all supported.
  document.addEventListener("mouseup", captureSelection, true);
  document.addEventListener("pointerup", captureSelection, true);
  document.addEventListener("keyup", (event) => {
    if (event.key.startsWith("Arrow") || event.key === "Shift") captureSelection(event);
  }, true);

  document.addEventListener("mousedown", (event) => {
    if (!bubble.contains(event.target) && !panel.contains(event.target) && !statusDot.contains(event.target)) hideBubble();
  }, true);

  function openPanel({ focusInput = false } = {}) {
    if (panel.style.display !== "flex") state.returnFocus = document.activeElement;
    panel.style.display = "flex";
    panel.setAttribute("aria-hidden", "false");
    $("#sideask-source").textContent = state.sourceTitle || location.hostname;
    $("#sideask-selection").textContent = state.selectedText || "自由提问";
    state.historyMode = false;
    showChatMode();
    renderMessages();
    if (focusInput) setTimeout(() => inputEl.focus(), 0);
  }

  function closePanel({ restoreFocus = true } = {}) {
    panel.style.display = "none";
    panel.setAttribute("aria-hidden", "true");
    hideBubble();
    if (restoreFocus && state.returnFocus?.isConnected && typeof state.returnFocus.focus === "function") {
      state.returnFocus.focus({ preventScroll: true });
    }
  }

  bubble.addEventListener("click", () => {
    hideBubble();
    openPanel();
    if (state.messages.length === 0) runQuickAction("simple");
  });

  statusDot.addEventListener("click", () => {
    if (panel.style.display === "flex") {
      closePanel();
      return;
    }
    openPanel({ focusInput: true });
  });

  $("#sideask-close-btn").addEventListener("click", closePanel);
  $("#sideask-min-btn").addEventListener("click", () => closePanel());
  $("#sideask-dashboard-btn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "sideask-open-dashboard" });
  });

  function renderMessages() {
    bodyEl.innerHTML = "";
    if (!state.messages.length) {
      bodyEl.innerHTML = `<div class="sideask-empty">正在围绕「${escapeHtml(state.selectedText || "当前内容") }」建立一条支线问题。</div>`;
      return;
    }
    for (const message of state.messages) {
      const row = document.createElement("div");
      row.className = `sideask-message ${message.role}`;
      const bubbleMsg = document.createElement("div");
      bubbleMsg.className = "sideask-bubble-msg";
      if (message.role === "assistant") {
        bubbleMsg.classList.add("sideask-markdown");
        bubbleMsg.appendChild(globalThis.SideAskMarkdown.renderMarkdown(message.content));
      } else {
        bubbleMsg.textContent = message.content;
      }
      if (message.streaming) {
        const caret = document.createElement("span");
        caret.className = "sideask-caret";
        bubbleMsg.appendChild(caret);
      }
      row.appendChild(bubbleMsg);
      bodyEl.appendChild(row);
    }
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  }

  function setStreaming(on) {
    state.streaming = on;
    sendEl.disabled = on;
    inputEl.disabled = on;
    panel.querySelectorAll(".sideask-chip").forEach(btn => btn.disabled = on);
    $("#sideask-understood").disabled = on;
    $("#sideask-unclear").disabled = on;
    statusEl.textContent = on ? "AI 正在回答…" : ({
      understood: "已沉淀到知识库",
      unclear: "已加入薄弱点",
      review: "等待复习",
      active: "本地保存",
    })[state.status];
  }

  const ACTION_QUESTIONS = {
    simple: "请用最容易理解的方式解释这个概念，先讲直觉，再讲它在当前上下文里的含义。",
    example: "请给我一个具体、尽量小的例子来理解这个概念，并把例子和当前上下文联系起来。",
    why: "这个概念为什么重要？请重点解释它在当前上下文里解决了什么问题。",
    deep: "请深入解释这个概念：核心机制、前置知识、与相邻概念的区别，以及当前上下文中最值得注意的点。"
  };

  function runQuickAction(action) {
    sendQuestion(ACTION_QUESTIONS[action] || ACTION_QUESTIONS.simple, true);
  }

  panel.querySelectorAll(".sideask-chip").forEach(btn => {
    btn.addEventListener("click", () => runQuickAction(btn.dataset.action));
  });

  async function sendQuestion(question, quick = false) {
    question = question.trim();
    if (!question || state.streaming) return;

    state.messages.push({ role: "user", content: quick ? actionLabel(question) : question, modelContent: question });
    state.messages.push({ role: "assistant", content: "", streaming: true });
    renderMessages();
    inputEl.value = "";
    setStreaming(true);

    const historyForModel = state.messages
      .slice(0, -1)
      .map(m => ({ role: m.role, content: m.modelContent || m.content }));

    const port = chrome.runtime.connect({ name: "sideask-stream" });
    let assistantText = "";
    let settled = false;
    let responseTimer = null;
    const RESPONSE_TIMEOUT_MS = 100_000;

    const armResponseTimer = () => {
      clearTimeout(responseTimer);
      responseTimer = setTimeout(() => {
        showRequestError("等待回答超时，请检查网络、Gateway 和 Provider 后重试。");
        try { port.disconnect(); } catch (_) {}
      }, RESPONSE_TIMEOUT_MS);
    };

    const showRequestError = message => {
      if (settled) return;
      settled = true;
      clearTimeout(responseTimer);
      const current = state.messages[state.messages.length - 1];
      current.streaming = false;
      current.content = assistantText || `回答失败：${message}\n\n请打开 SideAsk 管理页，在「模型服务」中确认默认 Provider 并测试连接。`;
      setStreaming(false);
      renderMessages();
    };

    armResponseTimer();

    port.onMessage.addListener(async (msg) => {
      if (msg.type === "delta") {
        if (settled) return;
        armResponseTimer();
        assistantText += msg.text;
        const current = state.messages[state.messages.length - 1];
        current.content = assistantText;
        renderMessages();
      } else if (msg.type === "done") {
        if (settled) return;
        if (!assistantText.trim()) {
          showRequestError("Provider 返回了空响应。请检查模型、额度或内容安全限制后重试。");
          port.disconnect();
          return;
        }
        settled = true;
        clearTimeout(responseTimer);
        const current = state.messages[state.messages.length - 1];
        current.streaming = false;
        setStreaming(false);
        renderMessages();
        try {
          await saveSession();
        } catch (error) {
          statusEl.textContent = error instanceof Error ? error.message : "保存支线失败";
        } finally {
          port.disconnect();
        }
      } else if (msg.type === "error") {
        showRequestError(msg.message || "SideAsk 请求失败。");
        port.disconnect();
      }
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      showRequestError("与扩展后台的连接意外中断，请重新加载扩展并刷新网页后重试。");
    });

    port.postMessage({
      type: "chat",
      payload: {
        selection: state.selectedText,
        context: state.context,
        sourceTitle: state.sourceTitle,
        sourceUrl: safeSourceUrl(),
        messages: historyForModel,
      }
    });
  }

  function actionLabel(full) {
    if (full === ACTION_QUESTIONS.simple) return "简单解释";
    if (full === ACTION_QUESTIONS.example) return "举个例子";
    if (full === ACTION_QUESTIONS.why) return "为什么重要";
    if (full === ACTION_QUESTIONS.deep) return "深入理解";
    return full;
  }

  sendEl.addEventListener("click", () => sendQuestion(inputEl.value));
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendQuestion(inputEl.value);
    }
  });

  async function saveSession() {
    if (!state.selectedText || state.messages.length < 2) return;
    if (!state.branchId) state.branchId = crypto.randomUUID?.() || `branch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const branch = {
      id: state.branchId,
      sessionId: state.sessionId,
      parentId: null,
      selectedText: state.selectedText,
      sourceContext: state.context,
      sourceTitle: state.sourceTitle,
      sourceUrl: state.anchor?.url || safeSourceUrl(),
      anchor: state.anchor,
      messages: state.messages.map(({ role, content, modelContent }) => ({ role, content, modelContent })),
      status: state.status,
      createdAt: state.anchor?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    const response = await chrome.runtime.sendMessage({ type: "sideask-branch-save", branch });
    if (!response?.ok) throw new Error(response?.error || "保存支线失败。");
    return response.data;
  }

  function updateStatusControls() {
    const understood = state.status === "understood";
    const unclear = state.status === "unclear";
    $("#sideask-understood").textContent = understood ? "✓ 已理解" : "✓ 我懂了";
    $("#sideask-understood").setAttribute("aria-pressed", String(understood));
    $("#sideask-unclear").textContent = unclear ? "? 仍模糊" : "? 还模糊";
    $("#sideask-unclear").setAttribute("aria-pressed", String(unclear));
    statusEl.textContent = understood ? "已沉淀到知识库" : (unclear ? "已加入薄弱点" : "本地保存");
  }

  async function setBranchStatus(status) {
    if (!state.messages.length) return;
    state.status = status;
    updateStatusControls();
    try {
      await saveSession();
    } catch (error) {
      statusEl.textContent = error instanceof Error ? error.message : "保存失败";
    }
  }

  $("#sideask-understood").addEventListener("click", () => setBranchStatus("understood"));
  $("#sideask-unclear").addEventListener("click", () => setBranchStatus("unclear"));

  function flashElement(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("sideask-flash");
    void el.offsetWidth;
    el.classList.add("sideask-flash");
    setTimeout(() => el.classList.remove("sideask-flash"), 2300);
  }

  function restoreAnchor() {
    closePanel({ restoreFocus: false });
    if (state.liveRange?.startContainer?.isConnected) {
      const el = closestReadableBlock(state.liveRange.startContainer);
      flashElement(el);
      return;
    }
    if (state.anchor?.selector) {
      try {
        const el = document.querySelector(state.anchor.selector);
        if (el && textOf(el).includes(state.anchor.selectedText)) {
          flashElement(el);
          return;
        }
      } catch (_) {}
    }
    if (state.anchor?.selectedText) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if ((walker.currentNode.nodeValue || "").includes(state.anchor.selectedText)) {
          flashElement(walker.currentNode.parentElement);
          return;
        }
      }
    }
    window.scrollTo({ top: state.anchor?.scrollY || 0, behavior: "smooth" });
  }

  $("#sideask-return").addEventListener("click", restoreAnchor);

  function showChatMode() {
    state.historyMode = false;
    historyEl.style.display = "none";
    bodyEl.style.display = "block";
    $("#sideask-context-card").style.display = "block";
    $("#sideask-footer").style.display = "block";
    $("#sideask-history-btn").textContent = "☰";
  }

  async function showHistoryMode() {
    state.historyMode = true;
    historyEl.style.display = "block";
    bodyEl.style.display = "none";
    $("#sideask-context-card").style.display = "none";
    $("#sideask-footer").style.display = "none";
    $("#sideask-history-btn").textContent = "←";
    const response = await chrome.runtime.sendMessage({ type: "sideask-branches-list", query: { limit: 100 } });
    const branches = response?.ok ? response.data : [];
    historyEl.innerHTML = `<div class="sideask-history-head">最近支线</div>`;
    if (!branches.length) {
      historyEl.innerHTML += `<div class="sideask-history-empty">还没有历史记录。随便划一个概念开始第一条支线吧。</div>`;
      return;
    }
    branches.forEach(branch => {
      const item = document.createElement("div");
      item.className = "sideask-history-item";
      item.setAttribute("role", "button");
      item.tabIndex = 0;
      item.innerHTML = `
        <div class="sideask-history-term">${escapeHtml(branch.status === "understood" ? "✓ " : branch.status === "unclear" ? "? " : "")}${escapeHtml(branch.selectedText)}</div>
        <div class="sideask-history-meta">${escapeHtml(branch.sourceTitle || branch.sourceUrl || "")}</div>`;
      const openHistoryItem = () => {
        state.branchId = branch.id;
        state.sessionId = branch.sessionId;
        state.selectedText = branch.selectedText;
        state.context = branch.sourceContext || "";
        state.sourceTitle = branch.sourceTitle || "历史支线";
        state.anchor = branch.anchor || null;
        state.liveRange = null;
        state.messages = branch.messages || [];
        state.status = branch.status || "active";
        $("#sideask-source").textContent = state.sourceTitle;
        $("#sideask-selection").textContent = state.selectedText;
        updateStatusControls();
        showChatMode();
        renderMessages();
        inputEl.focus();
      };
      item.addEventListener("click", openHistoryItem);
      item.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openHistoryItem();
        }
      });
      historyEl.appendChild(item);
    });
  }

  $("#sideask-history-btn").addEventListener("click", () => {
    if (state.historyMode) showChatMode();
    else showHistoryMode().catch(error => {
      statusEl.textContent = error instanceof Error ? error.message : "读取历史失败";
      showChatMode();
    });
  });

  chrome.runtime.onMessage?.addListener?.((message, _sender, sendResponse) => {
    if (message?.type === "sideask-ping") {
      sendResponse?.({ ok: true });
      return;
    }
    if (message?.type === "sideask-toggle") {
      if (panel.style.display === "flex") closePanel();
      else openPanel({ focusInput: true });
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && panel.style.display === "flex") closePanel();
  }, true);
})();
