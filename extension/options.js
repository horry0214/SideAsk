import { createPreviewBridge } from "./preview-data.js";

const I18N = globalThis.SideAskI18n;
let locale = I18N.detectLocale();
const t = (key, params) => I18N.t(locale, key, params);

const TITLES = {
  overview: ["page.overview.title", "page.overview.description"],
  branches: ["page.branches.title", "page.branches.description"],
  knowledge: ["page.knowledge.title", "page.knowledge.description"],
  weaknesses: ["page.weaknesses.title", "page.weaknesses.description"],
  providers: ["page.providers.title", "page.providers.description"],
  settings: ["page.settings.title", "page.settings.description"],
};

const PROVIDER_DEFAULTS = {
  "minimax-cn": { name: "MiniMax CN", model: "MiniMax-M2.7", noteKey: "providers.note.cn" },
  "minimax-global": { name: "MiniMax Global", model: "MiniMax-M2.7", noteKey: "providers.note.global" },
  "openai-compatible": { name: "OpenAI-compatible", model: "", noteKey: "providers.note.custom" },
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let providerState = { providers: [], defaultProviderId: null };
let toastTimer;
let currentSection = "overview";
const extensionRuntime = typeof chrome !== "undefined" && Boolean(chrome.runtime?.sendMessage);
const previewBridge = extensionRuntime ? null : createPreviewBridge();

const guarded = handler => (...args) => Promise.resolve(handler(...args)).catch(error => toast(error.message, true));

async function send(type, payload = {}) {
  if (previewBridge) return previewBridge.send(type, payload);
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || t("common.operationFailed"));
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
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function statusLabel(status) {
  const key = `status.${status}`;
  return t(key) === key ? status : t(key);
}

function empty(element, text = t("empty.records")) {
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
  const meta = document.createElement("div"); meta.className = "record-meta"; meta.textContent = `${branch.sourceTitle || branch.sourceUrl || t("source.unknown")} · ${formatDate(branch.updatedAt)}`;
  identity.append(title, meta);
  const preview = document.createElement("div"); preview.className = "record-preview"; preview.textContent = [...(branch.messages || [])].reverse().find(item => item.role === "assistant")?.content || branch.sourceContext || "";
  const badge = document.createElement("span"); badge.className = `badge ${branch.status}`; badge.textContent = statusLabel(branch.status);
  row.append(identity, preview, badge);
  return row;
}

function renderBranches(element, branches) {
  element.replaceChildren();
  if (!branches.length) return empty(element, t("empty.branches"));
  branches.forEach(branch => element.appendChild(createRecordRow(branch)));
}

async function refreshGateway() {
  const pill = $("#gateway-pill");
  const detail = $("#gateway-detail");
  pill.className = "gateway-pill";
  pill.querySelector("b").textContent = t("gateway.checking");
  try {
    const health = await send("sideask-gateway-health");
    pill.className = "gateway-pill online";
    const displayName = health.displayName || (health.region === "global" ? "MiniMax Global" : "MiniMax CN");
    pill.querySelector("b").textContent = `${displayName} · ${health.model || t("gateway.unconfigured")}`;
    detail.textContent = t("gateway.connected", { service: health.service, provider: displayName, endpoint: health.endpoint });
  } catch (error) {
    pill.className = "gateway-pill offline";
    pill.querySelector("b").textContent = t("gateway.offline");
    detail.textContent = error.message;
  }
}

async function loadOverview() {
  const [stats, branches] = await Promise.all([
    send("sideask-stats"),
    send("sideask-branches-list", { query: { limit: 6 } }),
  ]);
  const cards = [
    [t("overview.stat.branches"), stats.branches, t("overview.stat.branchesNote")],
    [t("overview.stat.understood"), stats.understood, t("overview.stat.understoodNote")],
    [t("overview.stat.knowledge"), stats.knowledge, t("overview.stat.knowledgeNote")],
    [t("overview.stat.review"), stats.weaknesses, t("overview.stat.reviewNote")],
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
  if (!items.length) return empty(list, t("empty.knowledge"));
  items.forEach(item => {
    const card = document.createElement("article"); card.className = "knowledge-card";
    const head = document.createElement("div"); head.className = "knowledge-card-head";
    const title = document.createElement("h3"); title.textContent = item.concept;
    const badge = document.createElement("span"); badge.className = `badge ${item.status}`; badge.textContent = statusLabel(item.status);
    head.append(title, badge);
    const body = document.createElement("p"); body.textContent = item.explanation || t("knowledge.pending");
    const foot = document.createElement("div"); foot.className = "knowledge-card-foot";
    const asks = document.createElement("span"); asks.textContent = t("knowledge.asks", { count: item.askCount });
    const seen = document.createElement("span"); seen.textContent = t("knowledge.recent", { date: formatDate(item.lastSeenAt) });
    foot.append(asks, seen); card.append(head, body, foot); list.appendChild(card);
  });
}

async function loadWeaknesses() {
  const items = await send("sideask-weaknesses-list", { query: { limit: 500 } });
  const list = $("#weakness-list"); list.replaceChildren();
  if (!items.length) return empty(list, t("empty.weaknesses"));
  items.forEach(item => {
    const row = document.createElement("div"); row.className = "record-row";
    const identity = document.createElement("div");
    const title = document.createElement("div"); title.className = "record-title"; title.textContent = item.knowledge.concept;
    const reasonKey = `weakness.reason.${item.reason}`;
    const reason = t(reasonKey) === reasonKey ? item.reason : t(reasonKey);
    const meta = document.createElement("div"); meta.className = "record-meta"; meta.textContent = `${reason} · ${formatDate(item.lastDetectedAt)}`;
    identity.append(title, meta);
    const preview = document.createElement("div"); preview.className = "record-preview"; preview.textContent = item.knowledge.explanation || "";
    const weight = document.createElement("span"); weight.className = "badge unclear"; weight.textContent = t("weakness.weight", { weight: item.weight });
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
    return empty(list, t("empty.providers"));
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
    const badge = document.createElement("span"); badge.className = `badge ${isDefault ? "understood" : ""}`; badge.textContent = isDefault ? t("providers.default") : t("providers.saved");
    head.append(titleWrap, badge);
    const meta = document.createElement("div"); meta.className = "provider-meta";
    const model = document.createElement("span"); model.textContent = `Model · ${provider.model}`;
    const key = document.createElement("span"); key.textContent = provider.apiKeyConfigured ? t("providers.keySaved") : t("providers.keyMissing");
    const endpoint = document.createElement("span"); endpoint.textContent = provider.baseUrl ? `Base URL · ${provider.baseUrl}` : t("providers.defaultEndpoint");
    meta.append(model, key, endpoint);
    const actions = document.createElement("div"); actions.className = "provider-actions";
    const edit = actionButton(t("providers.edit"), () => openProviderDialog(provider));
    const test = actionButton(t("providers.test"), () => testProvider(provider.id, test));
    actions.append(edit, test);
    if (!isDefault) actions.append(actionButton(t("providers.makeDefault"), () => setDefaultProvider(provider.id)));
    actions.append(actionButton(t("providers.delete"), () => deleteProvider(provider.id)));
    card.append(head, meta, actions); list.appendChild(card);
  });
}

function actionButton(label, handler) {
  const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.addEventListener("click", handler); return button;
}

async function testProvider(id, button) {
  const before = button.textContent; button.disabled = true; button.textContent = t("providers.testing");
  try {
    const result = await send("sideask-provider-test", { providerId: id });
    toast(result.modelAvailable === false ? t("providers.testModelMissing") : t("providers.testSuccess"));
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; button.textContent = before; }
}

async function setDefaultProvider(id) {
  try { await send("sideask-provider-default", { providerId: id }); toast(t("providers.defaultUpdated")); await loadProviders(); }
  catch (error) { toast(error.message, true); }
}

async function deleteProvider(id) {
  if (!confirm(t("providers.deleteConfirm"))) return;
  try { await send("sideask-provider-delete", { providerId: id }); toast(t("providers.deleted")); await loadProviders(); }
  catch (error) { toast(error.message, true); }
}

function updateProviderForm() {
  const type = $("#provider-type").value;
  const defaults = PROVIDER_DEFAULTS[type];
  const custom = type === "openai-compatible";
  $("#base-url-field").hidden = !custom;
  $("#provider-base-url").required = custom;
  $("#provider-form-note").textContent = t(defaults.noteKey);
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
  $("#provider-api-key").placeholder = provider?.apiKeyConfigured ? t("dialog.keyKeepPlaceholder") : t("dialog.keyPlaceholder");
  $("#provider-model").value = provider?.model || "";
  $("#provider-dialog-title").textContent = provider ? t("dialog.editProvider") : t("dialog.addProvider");
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
    $("#provider-dialog").close(); toast(t("providers.savedLocal")); await loadProviders();
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

async function showSection(name) {
  currentSection = name;
  $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.section === name));
  $$(".page-section").forEach(section => section.classList.toggle("active", section.id === `section-${name}`));
  $("#page-title").textContent = t(TITLES[name][0]); $("#page-description").textContent = t(TITLES[name][1]);
  try {
    if (name === "overview") await loadOverview();
    else if (name === "branches") await loadBranches();
    else if (name === "knowledge") await loadKnowledge();
    else if (name === "weaknesses") await loadWeaknesses();
    else if (name === "providers") await loadProviders();
    else if (name === "settings") await refreshGateway();
  } catch (error) { toast(error.message, true); }
}

function applyLocale(nextLocale) {
  locale = I18N.normalizeLocale(nextLocale);
  document.documentElement.lang = locale;
  I18N.apply(document, locale);
  $$(".language-switch [data-locale]").forEach(button => {
    const active = button.dataset.locale === locale;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("#page-title").textContent = t(TITLES[currentSection][0]);
  $("#page-description").textContent = t(TITLES[currentSection][1]);
  const version = extensionRuntime ? (chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version) : "0.3.0 MVP";
  $("#version-detail").innerHTML = `SideAsk v${String(version).replace(/^v/, "")}<br>Ask aside. Stay on track.`;
}

async function chooseLocale(nextLocale) {
  const saved = await I18N.saveLocale(nextLocale);
  applyLocale(saved);
  await Promise.allSettled([refreshGateway(), showSection(currentSection)]);
}

$$('.nav-item').forEach(button => button.addEventListener("click", () => showSection(button.dataset.section)));
$$('[data-go]').forEach(button => button.addEventListener("click", () => showSection(button.dataset.go)));
$("#add-provider").addEventListener("click", () => openProviderDialog());
$("#provider-type").addEventListener("change", updateProviderForm);
$("#provider-form").addEventListener("submit", saveProvider);
$$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => $("#provider-dialog").close()));
$$(".language-switch [data-locale]").forEach(button => button.addEventListener("click", guarded(() => chooseLocale(button.dataset.locale))));
$("#refresh-gateway").addEventListener("click", guarded(refreshGateway));
$("#branch-search").addEventListener("input", guarded(loadBranches));
$("#branch-status").addEventListener("change", guarded(loadBranches));
$("#knowledge-search").addEventListener("input", guarded(loadKnowledge));
$("#knowledge-status").addEventListener("change", guarded(loadKnowledge));

locale = await I18N.loadLocale();
applyLocale(locale);

if (extensionRuntime && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[I18N.STORAGE_KEY]?.newValue) return;
    const next = I18N.normalizeLocale(changes[I18N.STORAGE_KEY].newValue);
    if (next === locale) return;
    applyLocale(next);
    Promise.allSettled([refreshGateway(), showSection(currentSection)]);
  });
}

await Promise.allSettled([refreshGateway(), loadOverview()]);
