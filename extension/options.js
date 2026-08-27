import { createPreviewBridge } from "./preview-data.js";

const TITLES = {
  overview: ["概览", "你的支线学习状态都保存在本地。"],
  branches: ["历史支线", "每个问题都保留来源、上下文和理解状态。"],
  knowledge: ["知识库", "从已理解和仍模糊的支线中沉淀，而不是复制聊天记录。"],
  weaknesses: ["薄弱点", "记录反复出现或主动标记模糊的概念。"],
  providers: ["模型服务", "选择默认 Provider，并在本地管理 BYOK 配置。"],
  settings: ["设置", "检查本地 Gateway 与隐私边界。"],
};

const PROVIDER_DEFAULTS = {
  "minimax-cn": { name: "MiniMax CN", model: "MiniMax-M2.7", note: "MiniMax CN 默认使用 https://api.minimaxi.com/v1" },
  "minimax-global": { name: "MiniMax Global", model: "MiniMax-M2.7", note: "MiniMax Global 默认使用 https://api.minimax.io/v1" },
  "openai-compatible": { name: "OpenAI-compatible", model: "", note: "填写兼容 /chat/completions 和 /models 的 Base URL。" },
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let providerState = { providers: [], defaultProviderId: null };
let toastTimer;
const extensionRuntime = typeof chrome !== "undefined" && Boolean(chrome.runtime?.sendMessage);
const previewBridge = extensionRuntime ? null : createPreviewBridge();

const guarded = handler => (...args) => Promise.resolve(handler(...args)).catch(error => toast(error.message, true));

async function send(type, payload = {}) {
  if (previewBridge) return previewBridge.send(type, payload);
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || "SideAsk 操作失败。");
  return response.data;
}

if (previewBridge) {
  document.body.classList.add("preview-mode");
  $("#preview-badge").hidden = false;
}

function toast(message, error = false) {
  const element = $("#toast");
  element.textContent = message;
  element.className = `toast show${error ? " error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.className = "toast"; }, 3200);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function statusLabel(status) {
  return ({ active: "进行中", understood: "已理解", unclear: "还模糊", review: "待复习", weak: "薄弱", mastered: "已掌握" })[status] || status;
}

function empty(element, text = "还没有记录。") {
  element.replaceChildren();
  const node = document.createElement("div");
  node.className = "loading";
  node.textContent = text;
  element.appendChild(node);
}

function createRecordRow(branch) {
  const row = document.createElement("div");
  row.className = "record-row";
  const identity = document.createElement("div");
  const title = document.createElement("div"); title.className = "record-title"; title.textContent = branch.selectedText;
  const meta = document.createElement("div"); meta.className = "record-meta"; meta.textContent = `${branch.sourceTitle || branch.sourceUrl || "未知来源"} · ${formatDate(branch.updatedAt)}`;
  identity.append(title, meta);
  const preview = document.createElement("div"); preview.className = "record-preview"; preview.textContent = [...(branch.messages || [])].reverse().find(item => item.role === "assistant")?.content || branch.sourceContext || "";
  const badge = document.createElement("span"); badge.className = `badge ${branch.status}`; badge.textContent = statusLabel(branch.status);
  row.append(identity, preview, badge);
  return row;
}

function renderBranches(element, branches) {
  element.replaceChildren();
  if (!branches.length) return empty(element, "还没有支线。去网页选中一个概念，开始第一条支线吧。");
  branches.forEach(branch => element.appendChild(createRecordRow(branch)));
}

async function refreshGateway() {
  const pill = $("#gateway-pill");
  const detail = $("#gateway-detail");
  pill.className = "gateway-pill";
  pill.querySelector("b").textContent = "检查 Gateway…";
  try {
    const health = await send("sideask-gateway-health");
    pill.className = "gateway-pill online";
    const displayName = health.displayName || (health.region === "global" ? "MiniMax Global" : "MiniMax CN");
    pill.querySelector("b").textContent = `${displayName} · ${health.model || "未配置模型"}`;
    detail.textContent = `已连接 ${health.service}。默认环境 Provider：${displayName}，Endpoint：${health.endpoint}`;
  } catch (error) {
    pill.className = "gateway-pill offline";
    pill.querySelector("b").textContent = "Gateway 未连接";
    detail.textContent = error.message;
  }
}

async function loadOverview() {
  const [stats, branches] = await Promise.all([
    send("sideask-stats"),
    send("sideask-branches-list", { query: { limit: 6 } }),
  ]);
  const cards = [
    ["支线问题", stats.branches, "保留来源与 Anchor"],
    ["已理解", stats.understood, "已进入知识库"],
    ["知识条目", stats.knowledge, "由支线证据派生"],
    ["需要回顾", stats.weaknesses, "模糊或重复出现"],
  ];
  const grid = $("#stat-grid"); grid.replaceChildren();
  cards.forEach(([label, value, note]) => {
    const card = document.createElement("div"); card.className = "stat-card";
    const a = document.createElement("span"); a.textContent = label;
    const b = document.createElement("strong"); b.textContent = value;
    const c = document.createElement("em"); c.textContent = note;
    card.append(a, b, c); grid.appendChild(card);
  });
  renderBranches($("#overview-branches"), branches);
}

async function loadBranches() {
  const branches = await send("sideask-branches-list", { query: {
    limit: 500,
    search: $("#branch-search").value,
    status: $("#branch-status").value,
  } });
  renderBranches($("#branch-list"), branches);
}

async function loadKnowledge() {
  const items = await send("sideask-knowledge-list", { query: {
    limit: 500,
    search: $("#knowledge-search").value,
    status: $("#knowledge-status").value,
  } });
  const list = $("#knowledge-list"); list.replaceChildren();
  if (!items.length) return empty(list, "知识库还是空的。完成一条支线并点击“我懂了”后，它会出现在这里。");
  items.forEach(item => {
    const card = document.createElement("article"); card.className = "knowledge-card";
    const head = document.createElement("div"); head.className = "knowledge-card-head";
    const title = document.createElement("h3"); title.textContent = item.concept;
    const badge = document.createElement("span"); badge.className = `badge ${item.status}`; badge.textContent = statusLabel(item.status);
    head.append(title, badge);
    const body = document.createElement("p"); body.textContent = item.explanation || "等待下一次支线补充解释。";
    const foot = document.createElement("div"); foot.className = "knowledge-card-foot";
    const asks = document.createElement("span"); asks.textContent = `提问 ${item.askCount} 次`;
    const seen = document.createElement("span"); seen.textContent = `最近 ${formatDate(item.lastSeenAt)}`;
    foot.append(asks, seen); card.append(head, body, foot); list.appendChild(card);
  });
}

async function loadWeaknesses() {
  const items = await send("sideask-weaknesses-list", { query: { limit: 500 } });
  const list = $("#weakness-list"); list.replaceChildren();
  if (!items.length) return empty(list, "暂时没有薄弱点。");
  const reasons = { user_marked_unclear: "曾标记“还模糊”", repeated_question: "同一概念重复提问", forgotten: "复习时忘记", confused_concept: "容易混淆", low_confidence: "理解信心较低" };
  items.forEach(item => {
    const row = document.createElement("div"); row.className = "record-row";
    const identity = document.createElement("div");
    const title = document.createElement("div"); title.className = "record-title"; title.textContent = item.knowledge.concept;
    const meta = document.createElement("div"); meta.className = "record-meta"; meta.textContent = `${reasons[item.reason] || item.reason} · ${formatDate(item.lastDetectedAt)}`;
    identity.append(title, meta);
    const preview = document.createElement("div"); preview.className = "record-preview"; preview.textContent = item.knowledge.explanation || "";
    const weight = document.createElement("span"); weight.className = "badge unclear"; weight.textContent = `权重 ${item.weight}`;
    row.append(identity, preview, weight); list.appendChild(row);
  });
}

function providerLabel(type) {
  return ({ "minimax-cn": "MiniMax CN", "minimax-global": "MiniMax Global", "openai-compatible": "OpenAI-compatible" })[type] || type;
}

async function loadProviders() {
  providerState = await send("sideask-provider-state");
  const list = $("#provider-list"); list.replaceChildren();
  if (!providerState.providers.length) {
    return empty(list, "还没有浏览器 Provider 配置。Gateway 仍会使用 server/.env；添加 Provider 后即可在这里切换。 ");
  }
  providerState.providers.forEach(provider => {
    const isDefault = provider.id === providerState.defaultProviderId;
    const card = document.createElement("article"); card.className = `provider-card${isDefault ? " default" : ""}`;
    const head = document.createElement("div"); head.className = "provider-card-head";
    const titleWrap = document.createElement("div"); titleWrap.className = "provider-title";
    const icon = document.createElement("img"); icon.src = "assets/icons/icon-48.png"; icon.alt = "";
    const text = document.createElement("div"); const title = document.createElement("h3"); title.textContent = provider.displayName;
    const kind = document.createElement("div"); kind.className = "record-meta"; kind.textContent = providerLabel(provider.type);
    text.append(title, kind); titleWrap.append(icon, text);
    const badge = document.createElement("span"); badge.className = `badge ${isDefault ? "understood" : ""}`; badge.textContent = isDefault ? "默认" : "已保存";
    head.append(titleWrap, badge);
    const meta = document.createElement("div"); meta.className = "provider-meta";
    const model = document.createElement("span"); model.textContent = `Model · ${provider.model}`;
    const key = document.createElement("span"); key.textContent = provider.apiKeyConfigured ? "API Key · 已安全保存" : "API Key · 未配置";
    const endpoint = document.createElement("span"); endpoint.textContent = provider.baseUrl ? `Base URL · ${provider.baseUrl}` : "Endpoint · Provider 默认";
    meta.append(model, key, endpoint);
    const actions = document.createElement("div"); actions.className = "provider-actions";
    const edit = actionButton("编辑", () => openProviderDialog(provider));
    const test = actionButton("测试连接", () => testProvider(provider.id, test));
    actions.append(edit, test);
    if (!isDefault) actions.append(actionButton("设为默认", () => setDefaultProvider(provider.id)));
    actions.append(actionButton("删除", () => deleteProvider(provider.id)));
    card.append(head, meta, actions); list.appendChild(card);
  });
}

function actionButton(label, handler) {
  const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.addEventListener("click", handler); return button;
}

async function testProvider(id, button) {
  const before = button.textContent; button.disabled = true; button.textContent = "测试中…";
  try {
    const result = await send("sideask-provider-test", { providerId: id });
    toast(result.modelAvailable === false ? "连接成功，但 /models 中未发现当前模型。" : "Provider 连接成功。" );
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; button.textContent = before; }
}

async function setDefaultProvider(id) {
  try { await send("sideask-provider-default", { providerId: id }); toast("默认 Provider 已更新。"); await loadProviders(); }
  catch (error) { toast(error.message, true); }
}

async function deleteProvider(id) {
  if (!confirm("删除这个 Provider 配置？API Key 将从本地 IndexedDB 中移除。")) return;
  try { await send("sideask-provider-delete", { providerId: id }); toast("Provider 已删除。"); await loadProviders(); }
  catch (error) { toast(error.message, true); }
}

function updateProviderForm() {
  const type = $("#provider-type").value;
  const defaults = PROVIDER_DEFAULTS[type];
  const custom = type === "openai-compatible";
  $("#base-url-field").hidden = !custom;
  $("#provider-base-url").required = custom;
  $("#provider-form-note").textContent = defaults.note;
  if (!$("#provider-id").value) {
    $("#provider-name").value = defaults.name;
    $("#provider-model").value = defaults.model;
  }
}

function openProviderDialog(provider = null) {
  $("#provider-form").reset();
  $("#provider-id").value = provider?.id || "";
  $("#provider-type").value = provider?.type || "minimax-cn";
  $("#provider-type").disabled = Boolean(provider);
  $("#provider-name").value = provider?.displayName || "";
  $("#provider-base-url").value = provider?.baseUrl || "";
  $("#provider-api-key").value = "";
  $("#provider-api-key").required = !provider?.apiKeyConfigured;
  $("#provider-api-key").placeholder = provider?.apiKeyConfigured ? "留空以保留已保存的 Key" : "只保存在本地";
  $("#provider-model").value = provider?.model || "";
  $("#provider-dialog-title").textContent = provider ? "编辑 Provider" : "添加 Provider";
  updateProviderForm();
  $("#provider-dialog").showModal();
}

async function saveProvider(event) {
  event.preventDefault();
  const button = $("#save-provider"); button.disabled = true;
  try {
    await send("sideask-provider-save", { provider: {
      id: $("#provider-id").value || undefined,
      type: $("#provider-type").value,
      displayName: $("#provider-name").value,
      baseUrl: $("#provider-base-url").value,
      apiKey: $("#provider-api-key").value,
      model: $("#provider-model").value,
    } });
    $("#provider-dialog").close(); toast("Provider 已保存在本地。"); await loadProviders();
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

async function showSection(name) {
  $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.section === name));
  $$(".page-section").forEach(section => section.classList.toggle("active", section.id === `section-${name}`));
  $("#page-title").textContent = TITLES[name][0]; $("#page-description").textContent = TITLES[name][1];
  try {
    if (name === "overview") await loadOverview();
    else if (name === "branches") await loadBranches();
    else if (name === "knowledge") await loadKnowledge();
    else if (name === "weaknesses") await loadWeaknesses();
    else if (name === "providers") await loadProviders();
    else if (name === "settings") await refreshGateway();
  } catch (error) { toast(error.message, true); }
}

$$('.nav-item').forEach(button => button.addEventListener("click", () => showSection(button.dataset.section)));
$$('[data-go]').forEach(button => button.addEventListener("click", () => showSection(button.dataset.go)));
$("#add-provider").addEventListener("click", () => openProviderDialog());
$("#provider-type").addEventListener("change", updateProviderForm);
$("#provider-form").addEventListener("submit", saveProvider);
$$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => $("#provider-dialog").close()));
$("#refresh-gateway").addEventListener("click", guarded(refreshGateway));
$("#branch-search").addEventListener("input", guarded(loadBranches));
$("#branch-status").addEventListener("change", guarded(loadBranches));
$("#knowledge-search").addEventListener("input", guarded(loadKnowledge));
$("#knowledge-status").addEventListener("change", guarded(loadKnowledge));

await Promise.allSettled([refreshGateway(), loadOverview()]);
