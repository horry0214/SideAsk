(() => {
  const vscode = acquireVsCodeApi();
  const translations = {
    en: {
      tagline: "Ask aside. Stay on track.", selected: "CURRENT CONTEXT", backToSource: "Back to source",
      useClipboard: "Ask about clipboard", clipboardHint: "Useful for Codex Chat, terminals, and other extension views",
      simple: "Simple", example: "Example", why: "Why it matters", debug: "Find the issue",
      placeholder: "Ask a follow-up…", includeContext: "Include nearby lines", send: "Send",
      new: "New side question", provider: "Configure Provider", gatewayOnline: "Gateway online",
      gatewayOffline: "Gateway offline", answering: "Answering…", stopped: "Stopped",
      empty: "Choose a quick action or ask a focused question about this selection.",
      freeEmpty: "Paste context from the clipboard or type a free side question.",
      prompts: {
        simple: "Explain this selection simply in its current context.",
        example: "Give me a small concrete example of this selection.",
        why: "Why does this matter in the current code or context?",
        debug: "Inspect this selection and point out the most likely issue or misconception."
      }
    },
    "zh-CN": {
      tagline: "问题走支线，思路留主线。", selected: "当前上下文", backToSource: "回到原处",
      useClipboard: "询问剪贴板内容", clipboardHint: "适用于 Codex Chat、终端和其他扩展界面",
      simple: "简单解释", example: "举个例子", why: "为什么重要", debug: "找出问题",
      placeholder: "继续追问…", includeContext: "附带附近代码", send: "发送",
      new: "新建支线问题", provider: "配置 Provider", gatewayOnline: "Gateway 在线",
      gatewayOffline: "Gateway 离线", answering: "正在回答…", stopped: "已停止",
      empty: "选择一个快捷问题，或围绕当前选区自由提问。",
      freeEmpty: "从剪贴板带入上下文，或直接提出一个支线问题。",
      prompts: {
        simple: "请结合当前上下文，用简单直观的方式解释这段选中内容。",
        example: "请为这段选中内容给出一个具体、简短的例子。",
        why: "这段内容在当前代码或上下文中为什么重要？",
        debug: "请检查这段选中内容，指出最可能的问题或理解误区。"
      }
    }
  };

  let state = {
    locale: "en",
    source: null,
    messages: [],
    streaming: false,
    provider: null,
    gateway: { online: false }
  };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const text = () => translations[state.locale] || translations.en;

  function applyLocale() {
    document.documentElement.lang = state.locale;
    $$('[data-i18n]').forEach(element => {
      element.textContent = text()[element.dataset.i18n] || element.dataset.i18n;
    });
    $$('[data-i18n-placeholder]').forEach(element => {
      element.placeholder = text()[element.dataset.i18nPlaceholder] || "";
    });
    $$('[data-i18n-title]').forEach(element => {
      const value = text()[element.dataset.i18nTitle] || "";
      element.title = value;
      element.setAttribute("aria-label", value);
    });
  }

  function renderSource() {
    const source = state.source || {};
    $("#source-title").textContent = source.sourceTitle || "SideAsk";
    $("#selection").textContent = source.selectedText || "";
    $("#selection").hidden = !source.selectedText;
    $("#clipboard-button").hidden = Boolean(source.selectedText);
    $("#reveal-source").hidden = source.kind !== "editor";
    $("#include-context").disabled = !source.context;
    const meta = [];
    if (source.languageId && source.kind === "editor") meta.push(source.languageId);
    if (source.nearbyLines) meta.push(`${source.nearbyLines} lines`);
    $("#source-title").title = meta.join(" · ");
  }

  function messageElement(message) {
    const article = document.createElement("article");
    article.className = `message ${message.role}${message.streaming ? " streaming" : ""}`;
    article.dataset.id = message.id;
    const label = document.createElement("span");
    label.className = "message-label";
    label.textContent = message.role === "assistant" ? "SideAsk" : (state.locale === "zh-CN" ? "你" : "You");
    const body = document.createElement("div");
    body.className = "message-body";
    if (message.role === "assistant") {
      body.appendChild(globalThis.SideAskMarkdown.renderMarkdown(message.content || ""));
      if (message.streaming) {
        const caret = document.createElement("span");
        caret.className = "stream-caret";
        caret.textContent = "▋";
        body.appendChild(caret);
      }
    } else {
      body.textContent = message.content;
    }
    article.append(label, body);
    return article;
  }

  function renderMessages() {
    const container = $("#messages");
    container.replaceChildren();
    if (!state.messages.length) {
      const empty = document.createElement("div");
      empty.className = "conversation-empty";
      empty.textContent = state.source?.selectedText ? text().empty : text().freeEmpty;
      container.appendChild(empty);
      return;
    }
    state.messages.forEach(message => container.appendChild(messageElement(message)));
    requestAnimationFrame(() => container.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  function renderComposer() {
    $("#question").disabled = state.streaming;
    $("#send").textContent = state.streaming ? "■" : "↑";
    $("#send").title = state.streaming ? text().stopped : text().send;
    $$("[data-prompt]").forEach(button => button.disabled = state.streaming);
  }

  function renderStatus() {
    const button = $("#provider-status");
    button.classList.toggle("online", Boolean(state.gateway.online));
    const providerName = state.provider?.displayName || "Provider";
    const model = state.provider?.model ? ` · ${state.provider.model}` : "";
    button.querySelector("span").textContent = state.gateway.online
      ? `${providerName}${model}`
      : text().gatewayOffline;
    button.title = state.gateway.online ? text().gatewayOnline : text().gatewayOffline;
  }

  function render() {
    applyLocale();
    renderSource();
    renderMessages();
    renderComposer();
    renderStatus();
  }

  function submit(question) {
    const value = String(question || "").trim();
    if (!value || state.streaming) return;
    vscode.postMessage({ type: "ask", question: value, includeContext: $("#include-context").checked });
    $("#question").value = "";
    resizeComposer();
  }

  function resizeComposer() {
    const input = $("#question");
    input.style.height = "auto";
    input.style.height = `${Math.min(128, Math.max(24, input.scrollHeight))}px`;
  }

  $("#composer").addEventListener("submit", event => {
    event.preventDefault();
    if (state.streaming) vscode.postMessage({ type: "cancel" });
    else submit($("#question").value);
  });
  $("#question").addEventListener("input", resizeComposer);
  $("#question").addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit(event.currentTarget.value);
    }
  });
  $$("[data-prompt]").forEach(button => button.addEventListener("click", () => submit(text().prompts[button.dataset.prompt])));
  $("#new-button").addEventListener("click", () => vscode.postMessage({ type: "new" }));
  $("#provider-button").addEventListener("click", () => vscode.postMessage({ type: "configure" }));
  $("#provider-status").addEventListener("click", () => vscode.postMessage({ type: "configure" }));
  $("#reveal-source").addEventListener("click", () => vscode.postMessage({ type: "revealSource" }));
  $("#clipboard-button").addEventListener("click", () => vscode.postMessage({ type: "clipboard" }));

  window.addEventListener("message", event => {
    const message = event.data;
    if (message.type === "state") {
      state = { ...state, ...message, gateway: state.gateway };
      render();
      return;
    }
    if (message.type === "gateway") {
      state.gateway = message;
      renderStatus();
      return;
    }
    const target = state.messages.find(item => item.id === message.id);
    if (!target) return;
    if (message.type === "streamDelta") {
      target.content += message.delta;
      target.streaming = true;
      state.streaming = true;
      renderMessages();
      renderComposer();
    } else if (message.type === "streamDone") {
      target.streaming = false;
      state.streaming = false;
      renderMessages();
      renderComposer();
      $("#question").focus();
    } else if (message.type === "streamError") {
      target.streaming = false;
      if (!target.content) target.content = message.message;
      state.streaming = false;
      renderMessages();
      renderComposer();
    }
  });

  vscode.postMessage({ type: "ready" });
})();
