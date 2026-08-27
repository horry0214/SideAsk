import { sideAskStorage } from "./storage.js";

const SERVER_URL = "http://127.0.0.1:8787";
const PAGE_ORIGINS = ["http://*/*", "https://*/*"];
const PAGE_SCRIPT_ID = "sideask-page";
const CONSENT_KEY = "sideaskDataConsentV1";

async function readJsonResponse(response) {
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : {}; } catch (_) {}
  if (!response.ok) {
    const message = payload?.error?.message || (response.status >= 500
      ? "SideAsk Local Gateway 或 Provider 暂时不可用。"
      : `请求失败（HTTP ${response.status}）。`);
    throw new Error(String(message).slice(0, 500));
  }
  return payload || {};
}

async function requestGateway(path, options = {}) {
  try {
    const response = await fetch(`${SERVER_URL}${path}`, options);
    return await readJsonResponse(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("无法连接 SideAsk Local Gateway。请确认本地服务已启动。");
    }
    throw error;
  }
}

function providerForGateway(provider) {
  if (!provider) return null;
  return {
    id: provider.type,
    displayName: provider.displayName,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model: provider.model,
  };
}

async function initializeStorage() {
  const { sideaskHistory = [] } = await chrome.storage.local.get("sideaskHistory");
  return sideAskStorage.migrateLegacyHistory(sideaskHistory);
}

const storageReady = initializeStorage().catch(error => {
  console.error(`[Storage] ${error instanceof Error ? error.message : "initialization failed"}`);
});

async function injectIntoTab(tabId) {
  if (!tabId) return;
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["i18n.js", "markdown.js", "content.js"] });
  } catch (_) {
    // Protected pages reject injection.
  }
}

async function hasDataConsent() {
  const state = await chrome.storage.local.get(CONSENT_KEY);
  return state[CONSENT_KEY]?.accepted === true;
}

async function hasWebsiteAccess() {
  return chrome.permissions.contains({ origins: PAGE_ORIGINS });
}

async function performPageContentScriptSync({ injectExisting = false } = {}) {
  const [consented, permitted, registered] = await Promise.all([
    hasDataConsent(),
    hasWebsiteAccess(),
    chrome.scripting.getRegisteredContentScripts({ ids: [PAGE_SCRIPT_ID] }),
  ]);

  if (registered.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [PAGE_SCRIPT_ID] });
  }

  if (!consented || !permitted) return false;

  await chrome.scripting.registerContentScripts([{
    id: PAGE_SCRIPT_ID,
    matches: PAGE_ORIGINS,
    js: ["i18n.js", "markdown.js", "content.js"],
    css: ["content.css"],
    runAt: "document_idle",
    allFrames: false,
    persistAcrossSessions: true,
  }]);

  if (injectExisting) {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(tabs.map(tab => injectIntoTab(tab.id)));
  }
  return true;
}

let contentScriptSyncQueue = Promise.resolve(false);
function syncPageContentScript(options = {}) {
  contentScriptSyncQueue = contentScriptSyncQueue
    .catch(() => false)
    .then(() => performPageContentScriptSync(options));
  return contentScriptSyncQueue;
}

async function openWelcome() {
  await chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
}

async function ensureInjected(tabId) {
  if (!tabId) return false;
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "sideask-ping" });
    if (response?.ok) return true;
  } catch (_) {}
  await injectIntoTab(tabId);
  return true;
}

chrome.runtime.onInstalled.addListener(async details => {
  await storageReady;
  await syncPageContentScript();
  if (details.reason === "install") await openWelcome();
});

chrome.runtime.onStartup.addListener(() => {
  syncPageContentScript().catch(error => console.error(`[Permissions] ${error.message}`));
});

chrome.permissions.onAdded.addListener(() => {
  syncPageContentScript({ injectExisting: true }).catch(error => console.error(`[Permissions] ${error.message}`));
});

chrome.permissions.onRemoved.addListener(() => {
  syncPageContentScript().catch(error => console.error(`[Permissions] ${error.message}`));
});

chrome.action.onClicked.addListener(async tab => {
  if (!await hasDataConsent()) {
    await openWelcome();
    return;
  }
  await ensureInjected(tab.id);
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "sideask-toggle" });
  } catch (_) {}
});

async function handleExtensionMessage(message) {
  await storageReady;
  switch (message.type) {
    case "sideask-open-dashboard":
      await chrome.runtime.openOptionsPage();
      return { ok: true };
    case "sideask-open-welcome":
      await openWelcome();
      return { ok: true };
    case "sideask-consent-state":
      return { ok: true, data: { accepted: await hasDataConsent() } };
    case "sideask-consent-save":
      await chrome.storage.local.set({ [CONSENT_KEY]: { accepted: true, acceptedAt: Date.now(), version: 1 } });
      return { ok: true, data: { accepted: true } };
    case "sideask-site-access-state":
      return { ok: true, data: { granted: await hasWebsiteAccess() } };
    case "sideask-site-access-sync":
      return { ok: true, data: { granted: await syncPageContentScript({ injectExisting: true }) } };
    case "sideask-gateway-health":
      return { ok: true, data: await requestGateway("/health") };
    case "sideask-provider-state":
      return { ok: true, data: await sideAskStorage.listProviderState() };
    case "sideask-provider-save":
      return { ok: true, data: await sideAskStorage.saveProvider(message.provider) };
    case "sideask-provider-delete":
      return { ok: true, data: await sideAskStorage.deleteProvider(message.providerId) };
    case "sideask-provider-default":
      return { ok: true, data: await sideAskStorage.setDefaultProvider(message.providerId) };
    case "sideask-provider-test": {
      const provider = await sideAskStorage.getProvider(message.providerId);
      if (!provider) throw new Error("Provider 不存在。请先保存配置。");
      const data = await requestGateway("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerForGateway(provider) }),
      });
      return { ok: true, data };
    }
    case "sideask-branch-save":
      return { ok: true, data: await sideAskStorage.saveBranch(message.branch) };
    case "sideask-branch-status":
      return { ok: true, data: await sideAskStorage.updateBranchStatus(message.branchId, message.status) };
    case "sideask-branches-list":
      return { ok: true, data: await sideAskStorage.listBranches(message.query || {}) };
    case "sideask-knowledge-list":
      return { ok: true, data: await sideAskStorage.listKnowledge(message.query || {}) };
    case "sideask-weaknesses-list":
      return { ok: true, data: await sideAskStorage.listWeaknesses(message.query || {}) };
    case "sideask-stats":
      return { ok: true, data: await sideAskStorage.getStats() };
    default:
      return null;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type || !message.type.startsWith("sideask-")) return undefined;
  handleExtensionMessage(message)
    .then(result => {
      if (result) sendResponse(result);
    })
    .catch(error => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "SideAsk 操作失败。",
    }));
  return true;
});

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== "sideask-stream") return;

  let aborted = false;
  let timedOut = false;
  let timeoutId = null;
  const controller = new AbortController();
  const RESPONSE_TIMEOUT_MS = 90_000;

  const armTimeout = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, RESPONSE_TIMEOUT_MS);
  };

  port.onDisconnect.addListener(() => {
    aborted = true;
    clearTimeout(timeoutId);
    controller.abort();
  });

  port.onMessage.addListener(async message => {
    if (!message || message.type !== "chat") return;

    try {
      armTimeout();
      await storageReady;
      const activeProvider = await sideAskStorage.getActiveProvider();
      const payload = {
        ...message.payload,
        ...(activeProvider ? { provider: providerForGateway(activeProvider) } : {}),
      };
      const response = await fetch(`${SERVER_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        await readJsonResponse(response);
      }
      if (!response.body) throw new Error("Streaming response body is unavailable.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let receivedLength = 0;
      while (!aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          receivedLength += chunk.length;
          port.postMessage({ type: "delta", text: chunk });
          armTimeout();
        }
      }
      const tail = decoder.decode();
      if (tail && !aborted) {
        receivedLength += tail.length;
        port.postMessage({ type: "delta", text: tail });
      }
      if (!aborted && !receivedLength) {
        throw new Error("Provider 返回了空响应。请检查模型、额度或内容安全限制后重试。");
      }
      if (!aborted) port.postMessage({ type: "done" });
    } catch (error) {
      if (aborted) return;
      const messageText = timedOut
        ? "等待 Provider 响应超时，请检查网络和模型服务后重试。"
        : error instanceof TypeError
        ? "无法连接 SideAsk Local Gateway。请确认本地服务已启动。"
        : (error instanceof Error ? error.message : "SideAsk 请求失败。");
      port.postMessage({ type: "error", message: messageText });
    } finally {
      clearTimeout(timeoutId);
    }
  });
});
