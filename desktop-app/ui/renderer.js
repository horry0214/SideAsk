const api = window.sideaskDesktop;
const $ = selector => document.querySelector(selector);

if (new URLSearchParams(location.search).get("host") === "native") {
  document.documentElement.classList.add("native-host");
}

const COPY = {
  "zh-CN": {
    tagline: "问题走支线，思路留主线",
    selected: "你选中了",
    selectionEmpty: "在任意应用中选中文字，然后按全局快捷键",
    selectionEmptyAuto: "拖选或双击任意应用中的文字，旁边会出现 ✦ 解释",
    emptyTitle: "随处选中，原地理解",
    emptyBody: "选中文字后使用全局快捷键。SideAsk 会复制选区并自动开始解释。",
    emptyBodyAuto: "划词解释按钮已开启。拖选一段文字或双击选词，再点击旁边的 ✦ 解释。",
    input: "继续追问…",
    local: "本机处理",
    connecting: "正在连接 Gateway…",
    noProvider: "尚未配置共享 Provider",
    gatewayOffline: "Gateway 暂时不可用",
    gatewayOnline: "Gateway 已连接 · Provider Vault 本机加密",
    gatewayEnvironment: "Gateway 已连接 · 使用本机环境变量配置",
    settingsTitle: "本机设置",
    settingsSubtitle: "选择唤起方式，并管理浏览器与桌面端共用的模型。",
    autoCaptureTitle: "划词后显示解释按钮",
    autoCaptureDescription: "系统确认存在文字选区后才显示“✦ 解释”；普通拖拽不会触发，也不会自动发送 Ctrl+C。默认关闭。",
    autoCaptureSaved: enabled => enabled ? "划词解释按钮已开启" : "已关闭划词解释按钮",
    savedProviders: "已保存 Provider",
    add: "＋ 添加",
    noSaved: "还没有 Provider。添加后浏览器与桌面端会立即共用。",
    displayName: "显示名称",
    keyHint: "Key 只在 Gateway 本机加密保存；编辑时留空表示保留",
    cancel: "取消",
    save: "保存并测试",
    newQuestion: "＋ 新问题",
    returnApp: "↩ 回到原应用",
    privacy: "无账号 · 无云同步",
    actions: { simple: "简单解释", example: "举个例子", why: "为什么重要", deep: "深入理解" },
    prompts: {
      simple: "请用直白、简洁的方式解释它在这里是什么意思。",
      example: "请结合这里的语境举一个最小、具体的例子。",
      why: "请解释它为什么重要，以及忽略它可能造成什么误解。",
      deep: "请在不离开当前问题的前提下，深入解释原理、边界和常见误区。",
    },
    thinking: "正在理解选中的内容…",
    failed: message => `回答失败：${message}`,
    ready: "回答已完成",
    providerReady: name => `${name} 已保存并连接`,
    providerSaved: "Provider 已保存；连接测试未通过，可稍后重试。",
    edit: "编辑",
    use: "使用",
    current: "当前",
    test: "测试",
    remove: "删除",
    deleteConfirm: "删除这个共享 Provider？浏览器也会停止使用它。",
    deleted: "Provider 已删除",
    shortcutMissing: "全局快捷键注册失败，请从托盘打开 SideAsk。",
  },
  en: {
    tagline: "Ask aside. Stay on track.",
    selected: "You selected",
    selectionEmpty: "Select text in any app, then press the global shortcut",
    selectionEmptyAuto: "Drag or double-click text in any app to show ✦ Explain",
    emptyTitle: "Select anywhere. Understand in place.",
    emptyBody: "Select text and use the global shortcut. SideAsk copies it and starts a focused explanation.",
    emptyBodyAuto: "The selection Explain button is on. Drag across text or double-click a word, then click ✦ Explain.",
    input: "Ask a follow-up…",
    local: "On-device bridge",
    connecting: "Connecting to Gateway…",
    noProvider: "No shared Provider configured",
    gatewayOffline: "Gateway is unavailable",
    gatewayOnline: "Gateway connected · local encrypted Provider Vault",
    gatewayEnvironment: "Gateway connected · local environment configuration",
    settingsTitle: "Local settings",
    settingsSubtitle: "Choose how SideAsk appears and manage the model shared with the browser.",
    autoCaptureTitle: "Show Explain after selecting text",
    autoCaptureDescription: "Shows ✦ Explain only after Windows confirms a real text selection. Ordinary drags do not trigger it or send Ctrl+C. Off by default.",
    autoCaptureSaved: enabled => enabled ? "Selection Explain button is on" : "Selection Explain button is off",
    savedProviders: "Saved Providers",
    add: "＋ Add",
    noSaved: "No Provider yet. Add one and the browser will share it immediately.",
    displayName: "Display name",
    keyHint: "The Gateway encrypts this key locally; leave blank while editing to keep it",
    cancel: "Cancel",
    save: "Save and test",
    newQuestion: "＋ New question",
    returnApp: "↩ Return to app",
    privacy: "No account · No cloud sync",
    actions: { simple: "Simple", example: "Example", why: "Why it matters", deep: "Go deeper" },
    prompts: {
      simple: "Explain what this means here in a clear and concise way.",
      example: "Give one minimal, concrete example in this context.",
      why: "Explain why this matters and what misunderstanding it prevents.",
      deep: "Go deeper into the mechanism, boundaries, and common misconceptions without leaving the current question.",
    },
    thinking: "Understanding the selected text…",
    failed: message => `Answer failed: ${message}`,
    ready: "Answer complete",
    providerReady: name => `${name} saved and connected`,
    providerSaved: "Provider saved; its connection test did not pass yet.",
    edit: "Edit",
    use: "Use",
    current: "Current",
    test: "Test",
    remove: "Delete",
    deleteConfirm: "Delete this shared Provider? The browser will stop using it too.",
    deleted: "Provider deleted",
    shortcutMissing: "The global shortcut could not be registered. Open SideAsk from the tray.",
  },
};

const state = {
  locale: localStorage.getItem("sideaskDesktopLocale") || "zh-CN",
  shortcut: "Alt+Shift+A",
  pinned: false,
  autoCapture: false,
  streaming: false,
  requestId: null,
  selection: "",
  sourceTitle: "Desktop selection",
  messages: [],
  providers: [],
  defaultProviderId: null,
  catalog: [],
  health: null,
  version: "0.7.0",
};

let windowMode = "";

function setWindowMode(mode) {
  if (windowMode === mode) return;
  windowMode = mode;
  document.documentElement.dataset.windowMode = mode;
  api.setWindowMode?.(mode).catch(() => {});
}

function syncWindowMode() {
  const settingsOpen = !$("#settings-view").hidden;
  const hasActiveContent = Boolean(state.selection || state.messages.length || state.streaming);
  setWindowMode(settingsOpen || hasActiveContent ? "expanded" : "compact");
}

const text = () => COPY[state.locale] || COPY["zh-CN"];

function toast(message, error = false) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.toggle("error", error);
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.hidden = true; }, 2600);
}

function applyLocale() {
  document.documentElement.lang = state.locale;
  const copy = text();
  $("#brand-tagline").textContent = copy.tagline;
  $("#selected-label").textContent = copy.selected;
  $("#empty-title").textContent = copy.emptyTitle;
  $("#empty-body").textContent = state.autoCapture ? copy.emptyBodyAuto : copy.emptyBody;
  $("#question-input").placeholder = copy.input;
  $("#stream-status").textContent = state.streaming ? copy.thinking : copy.local;
  $("#settings-title").textContent = copy.settingsTitle;
  $("#settings-subtitle").textContent = copy.settingsSubtitle;
  $("#auto-capture-title").textContent = copy.autoCaptureTitle;
  $("#auto-capture-description").textContent = copy.autoCaptureDescription;
  $("#auto-capture-toggle").checked = state.autoCapture;
  $("#provider-list-title").textContent = copy.savedProviders;
  $("#add-provider").textContent = copy.add;
  $("#provider-name-label").textContent = copy.displayName;
  $("#key-hint").textContent = copy.keyHint;
  $("#cancel-provider").textContent = copy.cancel;
  $("#save-provider").textContent = copy.save;
  $("#new-button").textContent = copy.newQuestion;
  $("#return-button").textContent = copy.returnApp;
  $("#privacy-label").textContent = copy.privacy;
  $("#language-button").textContent = state.locale === "zh-CN" ? "EN" : "中";
  document.querySelectorAll("[data-action]").forEach(button => {
    button.textContent = copy.actions[button.dataset.action];
  });
  renderSelection();
  renderProviders();
  updateProviderBadge();
  updateGatewayStatus();
}

function renderSelection() {
  const element = $("#selection-text");
  element.textContent = state.selection || (state.autoCapture ? text().selectionEmptyAuto : text().selectionEmpty);
  element.classList.toggle("empty", !state.selection);
  $("#quick-actions").hidden = !state.selection;
  $("#source-title").textContent = state.sourceTitle || "Desktop selection";
}

function renderMessages() {
  const container = $("#messages");
  container.innerHTML = "";
  $("#empty-state").hidden = state.messages.length > 0;
  for (const message of state.messages) {
    const row = document.createElement("div");
    row.className = `message ${message.role}`;
    if (message.entering) row.classList.add("entering");
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    if (message.role === "assistant") {
      bubble.classList.add("sideask-markdown");
      bubble.appendChild(window.SideAskMarkdown.renderMarkdown(message.content || ""));
      if (message.streaming) {
        const caret = document.createElement("span");
        caret.className = "stream-caret";
        bubble.appendChild(caret);
      }
    } else {
      bubble.textContent = message.content;
    }
    row.appendChild(bubble);
    container.appendChild(row);
    message.entering = false;
  }
  container.scrollTop = container.scrollHeight;
}

function setStreaming(value) {
  state.streaming = Boolean(value);
  $("#send-button").disabled = state.streaming;
  $("#question-input").disabled = state.streaming;
  document.querySelectorAll("[data-action]").forEach(button => { button.disabled = state.streaming; });
  $("#stream-status").textContent = state.streaming ? text().thinking : text().local;
  api.setBusy(state.streaming);
}

function abortCurrent() {
  if (state.requestId) api.cancelChat(state.requestId);
  state.requestId = null;
  setStreaming(false);
}

function updateProviderBadge() {
  const provider = state.providers.find(item => item.id === state.defaultProviderId);
  $("#provider-badge").textContent = provider
    ? `${provider.displayName} · ${provider.model}`
    : (state.health?.model
        ? `${state.health.displayName || state.health.provider} · ${state.health.model}`
        : (state.health ? text().noProvider : text().gatewayOffline));
}

function updateGatewayStatus() {
  $("#gateway-card").classList.toggle("online", Boolean(state.health));
  $(".provider-strip").classList.toggle("online", Boolean(state.health));
  if (!state.health) return;
  $("#gateway-detail").textContent = state.health.providerStorage === "environment"
    ? text().gatewayEnvironment
    : text().gatewayOnline;
}

function currentProfile(type) {
  return state.catalog.find(profile => profile.id === type) || null;
}

function populateCatalog() {
  const select = $("#provider-type");
  select.innerHTML = "";
  for (const profile of state.catalog) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.displayName;
    select.appendChild(option);
  }
}

function populateModelSuggestions(profile) {
  const datalist = $("#model-suggestions");
  datalist.innerHTML = "";
  for (const model of profile?.suggestedModels || []) {
    const option = document.createElement("option");
    option.value = model;
    datalist.appendChild(option);
  }
}

function updateProviderForm({ resetDefaults = false } = {}) {
  const profile = currentProfile($("#provider-type").value);
  if (!profile) return;
  if (resetDefaults) {
    $("#provider-name").value = profile.displayName;
    $("#provider-base-url").value = profile.defaultBaseUrl || "";
    $("#provider-model").value = profile.defaultModel || "";
  }
  $("#provider-note").textContent = profile.note?.[state.locale] || profile.note?.en || "";
  populateModelSuggestions(profile);
  const editing = Boolean($("#provider-id").value);
  const existing = state.providers.find(item => item.id === $("#provider-id").value);
  $("#provider-api-key").required = Boolean(profile.apiKeyRequired && !(editing && existing?.apiKeyConfigured));
  $("#provider-base-url").required = true;
  $("#provider-model").required = true;
}

function openProviderForm(provider = null) {
  const form = $("#provider-form");
  form.hidden = false;
  $("#provider-id").value = provider?.id || "";
  $("#provider-type").value = provider?.type || "openai";
  $("#provider-type").disabled = Boolean(provider);
  $("#provider-name").value = provider?.displayName || "";
  $("#provider-base-url").value = provider?.baseUrl || "";
  $("#provider-model").value = provider?.model || "";
  $("#provider-api-key").value = "";
  updateProviderForm({ resetDefaults: !provider });
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeProviderForm() {
  $("#provider-form").hidden = true;
  $("#provider-form").reset();
  $("#provider-type").disabled = false;
}

function providerButton(label, handler, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", handler);
  return button;
}

function renderProviders() {
  const container = $("#provider-list");
  container.innerHTML = "";
  if (!state.providers.length) {
    const empty = document.createElement("div");
    empty.className = "provider-empty";
    empty.textContent = text().noSaved;
    container.appendChild(empty);
    return;
  }
  for (const provider of state.providers) {
    const item = document.createElement("div");
    item.className = "provider-item";
    const main = document.createElement("div");
    main.className = "provider-item-main";
    const title = document.createElement("strong");
    title.textContent = provider.displayName;
    const detail = document.createElement("small");
    detail.textContent = `${currentProfile(provider.type)?.displayName || provider.type} · ${provider.model}`;
    main.append(title, detail);
    const actions = document.createElement("div");
    actions.className = "provider-item-actions";
    const isDefault = provider.id === state.defaultProviderId;
    actions.append(
      providerButton(isDefault ? text().current : text().use, async () => {
        if (isDefault) return;
        await api.setDefaultProvider(provider.id);
        await refreshProviders();
      }, isDefault ? "default" : ""),
      providerButton(text().edit, () => openProviderForm(provider)),
      providerButton(text().test, async () => {
        try { await api.testProvider({ providerId: provider.id }); toast(text().providerReady(provider.displayName)); }
        catch (error) { toast(error.message, true); }
      }),
      providerButton(text().remove, async () => {
        if (!confirm(text().deleteConfirm)) return;
        await api.deleteProvider(provider.id);
        toast(text().deleted);
        await refreshProviders();
      }),
    );
    item.append(main, actions);
    container.appendChild(item);
  }
}

async function refreshProviders() {
  const providers = await api.listProviders();
  state.providers = providers.providers || [];
  state.defaultProviderId = providers.defaultProviderId || null;
  renderProviders();
  updateProviderBadge();
}

function showSettings() {
  $("#settings-view").hidden = false;
  syncWindowMode();
  refreshProviders().catch(error => toast(error.message, true));
}

function hideSettings() {
  closeProviderForm();
  $("#settings-view").hidden = true;
  syncWindowMode();
}

function newQuestion() {
  abortCurrent();
  state.selection = "";
  state.sourceTitle = "Desktop selection";
  state.messages = [];
  renderSelection();
  renderMessages();
  syncWindowMode();
  $("#question-input").focus();
}

function sendQuestion(question, displayQuestion = question) {
  const value = String(question || "").trim();
  if (!value || state.streaming) return;
  const environmentProviderCanRun = Boolean(
    state.health
    && (state.health.apiKeyConfigured || ["ollama", "lm-studio"].includes(state.health.provider)),
  );
  if (!state.defaultProviderId && !environmentProviderCanRun) {
    showSettings();
    toast(text().noProvider, true);
    return;
  }
  state.messages.push({ role: "user", content: displayQuestion, modelContent: value, entering: true });
  state.messages.push({ role: "assistant", content: "", streaming: true, entering: true });
  syncWindowMode();
  renderMessages();
  $("#question-input").value = "";
  setStreaming(true);
  const requestId = crypto.randomUUID();
  state.requestId = requestId;
  api.startChat(requestId, {
    selection: state.selection,
    sourceTitle: state.sourceTitle,
    locale: state.locale,
    messages: state.messages.slice(0, -1).map(message => ({
      role: message.role,
      content: message.modelContent || message.content,
    })),
  });
}

function handleCapture(capture) {
  abortCurrent();
  hideSettings();
  state.selection = String(capture?.text || "").trim();
  state.sourceTitle = capture?.sourceTitle || "Desktop selection";
  state.messages = [];
  renderSelection();
  renderMessages();
  document.documentElement.classList.remove("capture-arrived");
  requestAnimationFrame(() => document.documentElement.classList.add("capture-arrived"));
  clearTimeout(handleCapture.animationTimer);
  handleCapture.animationTimer = setTimeout(() => document.documentElement.classList.remove("capture-arrived"), 460);
  syncWindowMode();
  if (capture?.autoAsk && state.selection) {
    sendQuestion(text().prompts.simple, text().actions.simple);
  } else {
    $("#question-input").focus();
  }
}

api.onCapture(handleCapture);
api.onDesktopState(payload => {
  let copyChanged = false;
  if (Object.hasOwn(payload || {}, "pinned")) state.pinned = Boolean(payload.pinned);
  if (Object.hasOwn(payload || {}, "autoCapture")) {
    state.autoCapture = Boolean(payload.autoCapture);
    copyChanged = true;
  }
  if (Object.hasOwn(payload || {}, "resizing")) {
    document.documentElement.classList.toggle("window-resizing", Boolean(payload.resizing));
  }
  $("#pin-button").classList.toggle("active", state.pinned);
  $("#pin-button").setAttribute("aria-pressed", String(state.pinned));
  if (copyChanged) applyLocale();
});
api.onChatEvent(event => {
  if (!event || event.requestId !== state.requestId) return;
  const assistant = state.messages[state.messages.length - 1];
  if (!assistant || assistant.role !== "assistant") return;
  if (event.type === "delta") {
    assistant.content += event.text || "";
    renderMessages();
    return;
  }
  assistant.streaming = false;
  if (event.type === "error") assistant.content ||= text().failed(event.message || "Unknown error");
  if (event.type === "cancelled") assistant.content ||= state.locale === "en" ? "Cancelled." : "已取消。";
  state.requestId = null;
  setStreaming(false);
  renderMessages();
  if (event.type === "done") $("#stream-status").textContent = text().ready;
});

document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => sendQuestion(text().prompts[button.dataset.action], text().actions[button.dataset.action]));
});
$("#send-button").addEventListener("click", () => sendQuestion($("#question-input").value));
$("#question-input").addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendQuestion(event.currentTarget.value);
  }
});
$("#question-input").addEventListener("input", event => {
  event.currentTarget.style.height = "auto";
  event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 92)}px`;
});
$("#hide-button").addEventListener("click", () => api.hide());
$("#close-button").addEventListener("click", () => api.hide());
$("#return-button").addEventListener("click", () => api.hide());
$("#new-button").addEventListener("click", newQuestion);
$("#settings-button").addEventListener("click", showSettings);
$("#provider-badge").addEventListener("click", showSettings);
$("#settings-close").addEventListener("click", hideSettings);
$("#add-provider").addEventListener("click", () => openProviderForm());
$("#cancel-provider").addEventListener("click", closeProviderForm);
$("#provider-type").addEventListener("change", () => updateProviderForm({ resetDefaults: true }));
$("#pin-button").addEventListener("click", async () => {
  const result = await api.togglePin();
  state.pinned = Boolean(result?.pinned);
  $("#pin-button").classList.toggle("active", state.pinned);
  $("#pin-button").setAttribute("aria-pressed", String(state.pinned));
});
$("#auto-capture-toggle").addEventListener("change", async event => {
  const requested = Boolean(event.currentTarget.checked);
  event.currentTarget.disabled = true;
  try {
    const result = await api.setAutoCapture(requested);
    state.autoCapture = Boolean(result?.autoCapture);
    applyLocale();
    toast(text().autoCaptureSaved(state.autoCapture));
  } catch (error) {
    event.currentTarget.checked = state.autoCapture;
    toast(error.message, true);
  } finally {
    event.currentTarget.disabled = false;
  }
});
$("#language-button").addEventListener("click", () => {
  state.locale = state.locale === "zh-CN" ? "en" : "zh-CN";
  localStorage.setItem("sideaskDesktopLocale", state.locale);
  applyLocale();
});
$("#provider-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("#save-provider");
  button.disabled = true;
  try {
    const provider = {
      id: $("#provider-id").value || undefined,
      type: $("#provider-type").value,
      displayName: $("#provider-name").value,
      baseUrl: $("#provider-base-url").value,
      model: $("#provider-model").value,
      apiKey: $("#provider-api-key").value,
    };
    const saved = await api.saveProvider(provider);
    closeProviderForm();
    await refreshProviders();
    try {
      await api.testProvider({ providerId: saved.id });
      toast(text().providerReady(saved.displayName));
    } catch {
      toast(text().providerSaved, true);
    }
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

for (const dragRegion of document.querySelectorAll("[data-window-drag]")) {
  dragRegion.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.target.closest("button, input, textarea, select, a, label")) return;
    event.preventDefault();
    document.documentElement.classList.add("window-dragging");
    api.startDrag?.();
  });
}
for (const resizeZone of document.querySelectorAll("[data-window-resize]")) {
  resizeZone.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    api.startResize?.(resizeZone.dataset.windowResize);
  });
}
window.addEventListener("pointerup", () => document.documentElement.classList.remove("window-dragging"));
window.addEventListener("blur", () => document.documentElement.classList.remove("window-dragging"));

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (!$("#settings-view").hidden) hideSettings();
  else api.hide();
});
document.addEventListener("click", event => {
  const link = event.target.closest("a[href]");
  if (!link) return;
  event.preventDefault();
  api.openExternal(link.href);
});

const bootstrap = await api.ready();
state.version = bootstrap.version || state.version;
state.shortcut = bootstrap.shortcut || state.shortcut;
state.pinned = Boolean(bootstrap.pinned);
state.autoCapture = Boolean(bootstrap.autoCapture);
state.health = bootstrap.health || null;
state.providers = bootstrap.providers?.providers || [];
state.defaultProviderId = bootstrap.providers?.defaultProviderId || null;
state.catalog = bootstrap.catalog || [];
if (!localStorage.getItem("sideaskDesktopLocale")) state.locale = bootstrap.locale || state.locale;
populateCatalog();
$("#version-label").textContent = `SideAsk Desktop v${state.version}`;
$("#shortcut-label").textContent = state.shortcut || "Tray";
$("#pin-button").classList.toggle("active", state.pinned);
$("#pin-button").setAttribute("aria-pressed", String(state.pinned));
$("#gateway-detail").textContent = state.health ? "" : (bootstrap.gatewayError || text().gatewayOffline);
if (!state.shortcut) toast(text().shortcutMissing, true);
applyLocale();
renderMessages();
if (bootstrap.initialCapture) handleCapture(bootstrap.initialCapture);
else syncWindowMode();
