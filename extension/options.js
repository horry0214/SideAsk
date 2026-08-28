import { createPreviewBridge } from "./preview-data.js";
import {
  PROVIDER_CATALOG,
  getProviderProfile,
  providerNote,
} from "./provider-catalog.js";

const I18N = globalThis.SideAskI18n;
let locale = I18N.detectLocale();
const t = (key, params) => I18N.t(locale, key, params);

const TITLES = {
  recent: ["page.recent.title", "page.recent.description"],
  favorites: ["page.favorites.title", "page.favorites.description"],
  settings: ["page.settings.title", "page.settings.simpleDescription"],
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let providerState = { providers: [], defaultProviderId: null };
let toastTimer;
let currentSection = "recent";
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
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function empty(element, text) {
  element.replaceChildren();
  const node = document.createElement("div");
  node.className = "empty-state";
  const mark = document.createElement("span");
  mark.textContent = "✦";
  const copy = document.createElement("p");
  copy.textContent = text;
  node.append(mark, copy);
  element.appendChild(node);
}

function lastAnswer(branch) {
  return [...(branch.messages || [])].reverse().find(item => item.role === "assistant")?.content || branch.sourceContext || "";
}

function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function actionButton(label, handler, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

function createRecordCard(branch) {
  const card = document.createElement("article");
  card.className = "record-card";

  const head = document.createElement("div");
  head.className = "record-card-head";
  const identity = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = branch.selectedText;
  const meta = document.createElement("p");
  meta.textContent = `${branch.sourceTitle || branch.sourceUrl || t("source.unknown")} · ${formatDate(branch.updatedAt)}`;
  identity.append(title, meta);
  const star = document.createElement("span");
  star.className = `favorite-mark${branch.favorite ? " active" : ""}`;
  star.textContent = branch.favorite ? "★" : "☆";
  star.setAttribute("aria-hidden", "true");
  head.append(identity, star);

  const answer = document.createElement("p");
  answer.className = "record-answer";
  answer.textContent = lastAnswer(branch);

  const actions = document.createElement("div");
  actions.className = "record-actions";
  const favorite = actionButton(
    branch.favorite ? t("record.unfavorite") : t("record.favorite"),
    guarded(async () => {
      const nextFavorite = !branch.favorite;
      await send("sideask-branch-favorite", { branchId: branch.id, favorite: nextFavorite });
      toast(nextFavorite ? t("record.favorited") : t("record.unfavorited"));
      await refreshCurrentList();
    }),
    "favorite-btn",
  );
  favorite.setAttribute("aria-pressed", String(Boolean(branch.favorite)));
  actions.appendChild(favorite);

  const sourceUrl = safeSourceUrl(branch.sourceUrl);
  if (sourceUrl) {
    const link = document.createElement("a");
    link.href = sourceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = t("record.openSource");
    actions.appendChild(link);
  }

  card.append(head, answer, actions);
  return card;
}

function renderRecords(element, branches, emptyKey) {
  element.replaceChildren();
  if (!branches.length) return empty(element, t(emptyKey));
  branches.forEach(branch => element.appendChild(createRecordCard(branch)));
}

async function loadRecent() {
  const branches = await send("sideask-branches-list", {
    query: { limit: 500, search: $("#recent-search").value },
  });
  renderRecords($("#recent-list"), branches, "empty.recent");
}

async function loadFavorites() {
  const branches = await send("sideask-branches-list", {
    query: { limit: 500, search: $("#favorite-search").value, favorite: true },
  });
  renderRecords($("#favorite-list"), branches, "empty.favorites");
}

async function refreshCurrentList() {
  if (currentSection === "favorites") await loadFavorites();
  else if (currentSection === "recent") await loadRecent();
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

function providerLabel(type) {
  return getProviderProfile(type)?.displayName || type;
}

function populateProviderTypes() {
  const select = $("#provider-type");
  select.replaceChildren();
  const groups = new Map();
  for (const profile of PROVIDER_CATALOG) {
    if (!groups.has(profile.group)) {
      const group = document.createElement("optgroup");
      group.label = t(`providers.group.${profile.group}`);
      groups.set(profile.group, group);
      select.appendChild(group);
    }
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.displayName;
    groups.get(profile.group).appendChild(option);
  }
}

function populateModelSuggestions(profile, discovered = []) {
  const datalist = $("#provider-model-options");
  const models = [...new Set([...(discovered || []), ...(profile?.suggestedModels || [])])].slice(0, 200);
  datalist.replaceChildren(...models.map(model => {
    const option = document.createElement("option");
    option.value = model;
    return option;
  }));
  return models;
}

async function loadProviders() {
  providerState = await send("sideask-provider-state");
  const list = $("#provider-list");
  list.replaceChildren();
  if (!providerState.providers.length) return empty(list, t("empty.providers"));

  providerState.providers.forEach(provider => {
    const isDefault = provider.id === providerState.defaultProviderId;
    const card = document.createElement("article");
    card.className = `provider-card${isDefault ? " default" : ""}`;
    const head = document.createElement("div");
    head.className = "provider-card-head";
    const titleWrap = document.createElement("div");
    titleWrap.className = "provider-title";
    const icon = document.createElement("img");
    icon.src = "assets/icons/icon-48.png";
    icon.alt = "";
    const text = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = provider.displayName;
    const kind = document.createElement("div");
    kind.className = "record-meta";
    kind.textContent = providerLabel(provider.type);
    text.append(title, kind);
    titleWrap.append(icon, text);
    const badge = document.createElement("span");
    badge.className = `badge${isDefault ? " active" : ""}`;
    badge.textContent = isDefault ? t("providers.default") : t("providers.saved");
    head.append(titleWrap, badge);

    const meta = document.createElement("div");
    meta.className = "provider-meta";
    const model = document.createElement("span");
    model.textContent = `Model · ${provider.model}`;
    const key = document.createElement("span");
    key.textContent = provider.apiKeyConfigured ? t("providers.keySaved") : t("providers.keyMissing");
    const endpoint = document.createElement("span");
    endpoint.textContent = provider.baseUrl ? `Base URL · ${provider.baseUrl}` : t("providers.defaultEndpoint");
    meta.append(model, key, endpoint);

    const actions = document.createElement("div");
    actions.className = "provider-actions";
    const edit = actionButton(t("providers.edit"), () => openProviderDialog(provider));
    const test = actionButton(t("providers.test"), () => testProvider(provider.id, test));
    actions.append(edit, test);
    if (!isDefault) actions.append(actionButton(t("providers.makeDefault"), () => setDefaultProvider(provider.id)));
    actions.append(actionButton(t("providers.delete"), () => deleteProvider(provider.id)));
    card.append(head, meta, actions);
    list.appendChild(card);
  });
}

async function testProvider(id, button) {
  const before = button.textContent;
  button.disabled = true;
  button.textContent = t("providers.testing");
  try {
    const result = await send("sideask-provider-test", { providerId: id });
    toast(result.modelAvailable === false ? t("providers.testModelMissing") : t("providers.testSuccess"));
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = before;
  }
}

async function setDefaultProvider(id) {
  try {
    await send("sideask-provider-default", { providerId: id });
    toast(t("providers.defaultUpdated"));
    await loadProviders();
  } catch (error) {
    toast(error.message, true);
  }
}

async function deleteProvider(id) {
  if (!confirm(t("providers.deleteConfirm"))) return;
  try {
    await send("sideask-provider-delete", { providerId: id });
    toast(t("providers.deleted"));
    await loadProviders();
  } catch (error) {
    toast(error.message, true);
  }
}

function updateProviderForm() {
  const type = $("#provider-type").value;
  const profile = getProviderProfile(type) || PROVIDER_CATALOG[0];
  $("#base-url-field").hidden = !profile.baseUrlEditable;
  $("#provider-base-url").required = profile.baseUrlEditable && !profile.defaultBaseUrl;
  $("#provider-form-note").textContent = providerNote(profile, locale);
  const hasStoredKey = Boolean($("#provider-id").value && providerState.providers.find(item => item.id === $("#provider-id").value)?.apiKeyConfigured);
  $("#provider-api-key").required = profile.apiKeyRequired && !hasStoredKey;
  $("#provider-api-key").placeholder = hasStoredKey
    ? t("dialog.keyKeepPlaceholder")
    : (profile.apiKeyRequired ? t("dialog.keyPlaceholder") : t("dialog.keyOptionalPlaceholder"));
  populateModelSuggestions(profile);
  if (!$("#provider-id").value) {
    $("#provider-name").value = profile.displayName;
    $("#provider-model").value = profile.defaultModel;
    $("#provider-base-url").value = profile.defaultBaseUrl;
  }
}

function openProviderDialog(provider = null) {
  $("#provider-form").reset();
  $("#provider-id").value = provider?.id || "";
  $("#provider-type").value = provider?.type || "minimax-cn";
  $("#provider-type").disabled = Boolean(provider);
  $("#provider-name").value = provider?.displayName || "";
  const profile = getProviderProfile(provider?.type || "minimax-cn");
  $("#provider-base-url").value = provider?.baseUrl || profile?.defaultBaseUrl || "";
  $("#provider-api-key").value = "";
  $("#provider-model").value = provider?.model || "";
  $("#provider-dialog-title").textContent = provider ? t("dialog.editProvider") : t("dialog.addProvider");
  updateProviderForm();
  $("#provider-dialog").showModal();
}

async function discoverProviderModels() {
  const button = $("#discover-models");
  const before = button.textContent;
  button.disabled = true;
  button.textContent = t("providers.testing");
  try {
    const provider = {
      type: $("#provider-type").value,
      displayName: $("#provider-name").value,
      baseUrl: $("#provider-base-url").value,
      apiKey: $("#provider-api-key").value,
      model: $("#provider-model").value,
    };
    const result = await send("sideask-provider-test-draft", {
      providerId: $("#provider-id").value || undefined,
      provider,
    });
    const models = populateModelSuggestions(getProviderProfile(provider.type), result.models || []);
    if (!$("#provider-model").value && models[0]) $("#provider-model").value = models[0];
    $("#provider-form-note").textContent = result.discoveredModels
      ? t("providers.modelsFound", { count: result.discoveredModels })
      : t("providers.connectedNoModels");
    toast(t("providers.testSuccess"));
  } finally {
    button.disabled = false;
    button.textContent = before;
  }
}

async function saveProvider(event) {
  event.preventDefault();
  const button = $("#save-provider");
  button.disabled = true;
  try {
    await send("sideask-provider-save", { provider: {
      id: $("#provider-id").value || undefined,
      type: $("#provider-type").value,
      displayName: $("#provider-name").value,
      baseUrl: $("#provider-base-url").value,
      apiKey: $("#provider-api-key").value,
      model: $("#provider-model").value,
    } });
    $("#provider-dialog").close();
    toast(t("providers.savedLocal"));
    await loadProviders();
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function showSection(name) {
  if (!Object.hasOwn(TITLES, name)) name = "recent";
  currentSection = name;
  $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.section === name));
  $$(".page-section").forEach(section => section.classList.toggle("active", section.id === `section-${name}`));
  $("#page-title").textContent = t(TITLES[name][0]);
  $("#page-description").textContent = t(TITLES[name][1]);
  try {
    if (name === "recent") await loadRecent();
    else if (name === "favorites") await loadFavorites();
    else await Promise.all([loadProviders(), refreshGateway()]);
  } catch (error) {
    toast(error.message, true);
  }
}

function applyLocale(nextLocale) {
  const selectedProviderType = $("#provider-type").value || "minimax-cn";
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
  populateProviderTypes();
  $("#provider-type").value = getProviderProfile(selectedProviderType)?.id || "minimax-cn";
  const version = extensionRuntime ? (chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version) : "0.5.0 Provider Catalog";
  $("#version-detail").innerHTML = `SideAsk v${String(version).replace(/^v/, "")}<br>Ask aside. Stay on track.`;
}

async function chooseLocale(nextLocale) {
  const saved = await I18N.saveLocale(nextLocale);
  applyLocale(saved);
  await Promise.all([refreshGateway(), showSection(currentSection)]);
}

async function openWelcome() {
  if (previewBridge) {
    window.location.href = "/preview/welcome.html?preview=ready";
    return;
  }
  await send("sideask-open-welcome");
}

$$(".nav-item").forEach(button => button.addEventListener("click", () => showSection(button.dataset.section)));
$("#add-provider").addEventListener("click", () => openProviderDialog());
$("#provider-type").addEventListener("change", updateProviderForm);
$("#provider-form").addEventListener("submit", saveProvider);
$("#discover-models").addEventListener("click", guarded(discoverProviderModels));
$$("[data-close-dialog]").forEach(button => button.addEventListener("click", () => $("#provider-dialog").close()));
$$(".language-switch [data-locale]").forEach(button => button.addEventListener("click", guarded(() => chooseLocale(button.dataset.locale))));
$("#refresh-gateway").addEventListener("click", guarded(refreshGateway));
$("#open-welcome").addEventListener("click", guarded(openWelcome));
$("#recent-search").addEventListener("input", guarded(loadRecent));
$("#favorite-search").addEventListener("input", guarded(loadFavorites));

locale = await I18N.loadLocale();
applyLocale(locale);

const query = new URLSearchParams(window.location.search);
const legacySectionMap = {
  overview: "recent",
  branches: "recent",
  knowledge: "favorites",
  weaknesses: "favorites",
  providers: "settings",
};
currentSection = legacySectionMap[query.get("section")] || query.get("section") || "recent";
if (!Object.hasOwn(TITLES, currentSection)) currentSection = "recent";

if (extensionRuntime && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[I18N.STORAGE_KEY]?.newValue) return;
    const next = I18N.normalizeLocale(changes[I18N.STORAGE_KEY].newValue);
    if (next === locale) return;
    applyLocale(next);
    Promise.allSettled([refreshGateway(), showSection(currentSection)]);
  });
}

await Promise.allSettled([refreshGateway(), showSection(currentSection)]);
if (query.get("add") === "1") {
  await showSection("settings");
  openProviderDialog();
}
