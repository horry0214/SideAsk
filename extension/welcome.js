const I18N = globalThis.SideAskI18n;
const PAGE_ORIGINS = ["http://*/*", "https://*/*"];
const extensionRuntime = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
const previewReady = new URLSearchParams(location.search).get("preview") === "ready";

const COPY = {
  en: {
    brandTagline:"Ask aside. Stay on track.",dashboard:"Open dashboard",eyebrow:"THREE-MINUTE SETUP",heroTitle:"Get your first side answer flowing.",heroBody:"Connect the local Gateway, add the model you already use, then try SideAsk on a real selection.",trustLocal:"✓ Local-first history",trustKey:"✓ Bring your own key",trustNoAccount:"✓ No SideAsk account",explain:"Explain",answerTitle:"A question, without a detour",answerBody:"Your answer opens beside the page and stays attached to its source.",
    disclosureTitle:"Before SideAsk reads a selection",disclosureBody:"Only text you deliberately select, a small amount of nearby readable context, the source URL without query or hash, and messages in this side question are sent through your local Gateway to the AI Provider you choose. Passwords, form fields and editor drafts are excluded. Provider keys, recent questions, and favorites stay in extension-private storage. SideAsk has no telemetry, ads or cloud database.",privacyLink:"Read the full privacy policy ↗",acceptDisclosure:"I understand — continue",acceptedDisclosure:"Privacy choices saved ✓",
    setupKicker:"FIRST-RUN CHECKLIST",setupTitle:"Three things, checked as you go",gatewayTitle:"Start the local Gateway",gatewayBody:"The Gateway keeps Provider calls outside the web page and listens only on your computer.",checking:"Checking…",gatewayDetail:"Run this command inside the downloaded SideAsk folder, then keep the terminal open.",downloadGateway:"Download Gateway",checkAgain:"Check again",copy:"Copy",copied:"Copied",gatewayOnline:"Connected",gatewayOffline:"Not connected",gatewayConnected:"Connected to {{service}} on 127.0.0.1:8787.",gatewayMissing:"Start the Gateway, then choose “Check again”.",
    providerTitle:"Connect your AI Provider",providerBody:"Choose MiniMax CN, MiniMax Global, or any OpenAI-compatible endpoint. Your API key stays local.",providerMissing:"No browser Provider is configured yet.",addProvider:"Add Provider",refresh:"Refresh",configured:"Configured",providerReady:"{{name}} · {{model}} · saved locally",providerMissingStatus:"Not configured",
    selectionTitle:"Enable selection and try it once",selectionBody:"Grant website access only when you are ready. You can revoke it here at any time.",waiting:"Waiting",accessOff:"Website access is off",accessOffDetail:"SideAsk will not run automatically on websites until you enable it.",accessOn:"Website access is on",accessOnDetail:"SideAsk can show the Explain button after you select text on regular HTTP and HTTPS pages.",enableAccess:"Enable on websites",disableAccess:"Disable website access",trySelection:"Try your first selection",readyToTry:"Ready to try",firstDone:"First selection complete",permissionDeclined:"Website access was not granted. You can try again when ready.",consentFirst:"Please review the data disclosure first.",
    readyTitle:"SideAsk is ready.",readyBody:"Select text on any regular web page and choose “✦ Explain”. Questions are saved locally; favorite only what is worth revisiting.",viewDashboard:"View recent questions",operationFailed:"SideAsk could not complete that action.",popupBlocked:"Your browser blocked the new tab. Open SideAsk from the extension menu.",accessRemoved:"Website access removed.",practiceNeedsSetup:"Finish Gateway and Provider setup first so the practice answer can load."
  },
  "zh-CN": {
    brandTagline:"问题走支线，思路留主线",dashboard:"打开 SideAsk",eyebrow:"约三分钟完成",heroTitle:"让第一条支线回答真正跑起来。",heroBody:"连接本地 Gateway，添加你已经在用的模型，然后用一次真实划词完成上手。",trustLocal:"✓ 最近记录本地保存",trustKey:"✓ 使用自己的 API Key",trustNoAccount:"✓ 无需 SideAsk 账户",explain:"解释",answerTitle:"问题走支线，不打断主线",answerBody:"回答在原文旁展开，并始终保留来源锚点。",
    disclosureTitle:"在 SideAsk 读取划词内容之前",disclosureBody:"只有你主动选中的文字、少量附近可读上下文、移除 query/hash 的来源 URL，以及当前支线消息，会经由你的本地 Gateway 发送给你选择的 AI Provider。密码、表单字段与编辑器草稿会被排除。Provider Key、最近提问和收藏保存在扩展私有存储中。SideAsk 不含遥测、广告或云数据库。",privacyLink:"阅读完整隐私政策 ↗",acceptDisclosure:"我已了解，继续设置",acceptedDisclosure:"隐私选择已保存 ✓",
    setupKicker:"首次使用清单",setupTitle:"三步完成，状态自动检查",gatewayTitle:"启动本地 Gateway",gatewayBody:"Gateway 把 Provider 请求隔离在网页之外，并且只监听你自己的电脑。",checking:"检查中…",gatewayDetail:"在下载并解压的 SideAsk 文件夹中运行此命令，然后保持终端开启。",downloadGateway:"下载 Gateway",checkAgain:"重新检查",copy:"复制",copied:"已复制",gatewayOnline:"已连接",gatewayOffline:"未连接",gatewayConnected:"已连接 {{service}} · 127.0.0.1:8787。",gatewayMissing:"请先启动 Gateway，再点击“重新检查”。",
    providerTitle:"连接 AI Provider",providerBody:"支持 MiniMax CN、MiniMax Global 或任意 OpenAI-compatible 服务，API Key 只保存在本地。",providerMissing:"还没有配置浏览器 Provider。",addProvider:"添加 Provider",refresh:"刷新",configured:"已配置",providerReady:"{{name}} · {{model}} · 已保存在本地",providerMissingStatus:"未配置",
    selectionTitle:"启用划词并亲自试一次",selectionBody:"准备好后再授予网页访问权；你可以随时在这里撤销。",waiting:"等待完成",accessOff:"网页访问尚未开启",accessOffDetail:"启用前，SideAsk 不会自动在网页中运行。",accessOn:"网页访问已开启",accessOnDetail:"在普通 HTTP/HTTPS 网页划词后，SideAsk 可以显示“解释”入口。",enableAccess:"在网页中启用",disableAccess:"停用网页访问",trySelection:"尝试第一次划词",readyToTry:"可以体验",firstDone:"首次划词已完成",permissionDeclined:"没有获得网页访问权；准备好后可以再次尝试。",consentFirst:"请先阅读并确认上方的数据说明。",
    readyTitle:"SideAsk 已经准备好了。",readyBody:"以后在普通网页中选中文字，再点击“✦ 解释”即可。问题会自动保存在本地，值得以后再看时点一下收藏。",viewDashboard:"查看最近提问",operationFailed:"SideAsk 未能完成这个操作。",popupBlocked:"浏览器拦截了新标签页，请从扩展菜单打开 SideAsk。",accessRemoved:"网页访问权已撤销。",practiceNeedsSetup:"请先完成 Gateway 与 Provider 配置，练习页才能得到真实回答。"
  }
};

const $ = selector => document.querySelector(selector);
let locale = I18N.detectLocale();
let state = { consent:false, gateway:false, provider:null, access:false, branches:0 };
let toastTimer;

function t(key, params = {}) {
  let value = COPY[locale]?.[key] || COPY.en[key] || key;
  for (const [name, replacement] of Object.entries(params)) value = value.replaceAll(`{{${name}}}`, String(replacement));
  return value;
}

function toast(message, error = false) {
  const node = $("#toast");
  node.textContent = message;
  node.className = `toast show${error ? " error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.className = "toast"; }, 3200);
}

async function send(type) {
  if (extensionRuntime) {
    const response = await chrome.runtime.sendMessage({ type });
    if (!response?.ok) throw new Error(response?.error || t("operationFailed"));
    return response.data;
  }
  if (type === "sideask-consent-state") return { accepted: previewReady || localStorage.getItem("sideaskPreviewConsent") === "yes" };
  if (type === "sideask-consent-save") { localStorage.setItem("sideaskPreviewConsent", "yes"); return { accepted:true }; }
  if (type === "sideask-provider-state") return previewReady ? { providers:[{ id:"demo", displayName:"MiniMax CN", model:"MiniMax-M2.7" }], defaultProviderId:"demo" } : { providers:[], defaultProviderId:null };
  if (type === "sideask-site-access-state") return { granted:previewReady || localStorage.getItem("sideaskPreviewAccess") === "yes" };
  if (type === "sideask-site-access-sync") return { granted:true };
  if (type === "sideask-stats") return { branches:previewReady ? 1 : 0 };
  if (type === "sideask-gateway-health") {
    if (previewReady) return { service:"SideAsk Local Gateway", model:"MiniMax-M2.7" };
    const response = await fetch("http://127.0.0.1:8787/health");
    if (!response.ok) throw new Error(t("gatewayMissing"));
    return response.json();
  }
  return {};
}

function setBadge(node, label, mode) {
  node.textContent = label;
  node.className = `status-badge ${mode}`;
}

function render() {
  document.documentElement.lang = locale;
  document.querySelectorAll("[data-copy]").forEach(node => { node.textContent = t(node.dataset.copy); });
  document.querySelectorAll("[data-locale]").forEach(button => button.classList.toggle("active", button.dataset.locale === locale));

  const disclosure = $("#disclosure-card");
  disclosure.classList.toggle("accepted", state.consent);
  $("#accept-disclosure").textContent = t(state.consent ? "acceptedDisclosure" : "acceptDisclosure");
  $("#accept-disclosure").disabled = state.consent;

  $("#gateway-step").classList.toggle("complete", state.gateway);
  setBadge($("#gateway-status"), t(state.gateway ? "gatewayOnline" : "gatewayOffline"), state.gateway ? "online" : "offline");
  $("#gateway-detail").textContent = state.gateway
    ? t("gatewayConnected", { service: state.gateway.service || "SideAsk Local Gateway" })
    : t("gatewayMissing");

  const providerReady = Boolean(state.provider);
  $("#provider-step").classList.toggle("complete", providerReady);
  setBadge($("#provider-status"), t(providerReady ? "configured" : "providerMissingStatus"), providerReady ? "online" : "offline");
  $("#provider-detail").textContent = providerReady
    ? t("providerReady", { name:state.provider.displayName, model:state.provider.model })
    : t("providerMissing");

  const firstDone = state.branches > 0;
  $("#selection-step").classList.toggle("complete", firstDone);
  setBadge($("#selection-status"), t(firstDone ? "firstDone" : state.access ? "readyToTry" : "waiting"), firstDone ? "online" : state.access ? "online" : "checking");
  $("#access-dot").classList.toggle("on", state.access);
  $("#access-title").textContent = t(state.access ? "accessOn" : "accessOff");
  $("#access-detail").textContent = t(state.access ? "accessOnDetail" : "accessOffDetail");
  $("#toggle-access").disabled = !state.consent;
  $("#toggle-access").textContent = t(state.access ? "disableAccess" : "enableAccess");
  $("#open-practice").disabled = !state.access;

  const completed = Number(Boolean(state.gateway)) + Number(providerReady) + Number(firstDone);
  $("#progress-label").textContent = `${completed} / 3`;
  $("#progress-bar").style.width = `${completed / 3 * 100}%`;
  $("#ready-card").hidden = completed !== 3;
}

async function refresh() {
  const [consentResult, gatewayResult, providerResult, accessResult, statsResult] = await Promise.allSettled([
    send("sideask-consent-state"), send("sideask-gateway-health"), send("sideask-provider-state"), send("sideask-site-access-state"), send("sideask-stats"),
  ]);
  state.consent = consentResult.status === "fulfilled" && consentResult.value.accepted;
  state.gateway = gatewayResult.status === "fulfilled" ? gatewayResult.value : false;
  if (providerResult.status === "fulfilled") {
    const providerState = providerResult.value;
    state.provider = providerState.providers.find(item => item.id === providerState.defaultProviderId) || providerState.providers[0] || null;
  } else state.provider = null;
  state.access = accessResult.status === "fulfilled" && accessResult.value.granted;
  state.branches = statsResult.status === "fulfilled" ? Number(statsResult.value.branches || 0) : 0;
  render();
}

async function chooseLocale(nextLocale) {
  locale = await I18N.saveLocale(nextLocale);
  render();
}

async function openExtensionPage(path) {
  if (extensionRuntime) return chrome.tabs.create({ url:chrome.runtime.getURL(path) });
  const target = path.startsWith("options.html") ? `/preview/${path}` : `/preview/${path}`;
  window.open(target, "_blank", "noopener");
}

$("#accept-disclosure").addEventListener("click", async () => {
  try { await send("sideask-consent-save"); state.consent = true; render(); }
  catch (error) { toast(error.message, true); }
});
$("#copy-command").addEventListener("click", async () => {
  await navigator.clipboard.writeText("npm start");
  toast(t("copied"));
});
$("#download-gateway").addEventListener("click", () => window.open("https://github.com/horry0214/sideask/releases/latest/download/sideask-gateway.zip", "_blank", "noopener"));
$("#check-gateway").addEventListener("click", refresh);
$("#check-provider").addEventListener("click", refresh);
$("#add-provider").addEventListener("click", () => openExtensionPage("options.html?section=providers&add=1&from=welcome"));
$("#open-dashboard").addEventListener("click", () => openExtensionPage("options.html"));
$("#ready-dashboard").addEventListener("click", () => openExtensionPage("options.html"));
$("#toggle-access").addEventListener("click", async () => {
  try {
    if (!state.consent) return toast(t("consentFirst"), true);
    if (extensionRuntime) {
      const granted = state.access
        ? !await chrome.permissions.remove({ origins:PAGE_ORIGINS })
        : await chrome.permissions.request({ origins:PAGE_ORIGINS });
      if (!granted && !state.access) toast(t("permissionDeclined"), true);
      await send("sideask-site-access-sync");
    } else {
      state.access = !state.access;
      localStorage.setItem("sideaskPreviewAccess", state.access ? "yes" : "no");
    }
    await refresh();
    if (!state.access) toast(t("accessRemoved"));
  } catch (error) { toast(error.message, true); }
});
$("#open-practice").addEventListener("click", () => {
  if (!state.gateway || !state.provider) toast(t("practiceNeedsSetup"), true);
  openExtensionPage("practice.html");
});
document.querySelectorAll("[data-locale]").forEach(button => button.addEventListener("click", () => chooseLocale(button.dataset.locale)));
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
window.addEventListener("focus", refresh);

locale = await I18N.loadLocale();
await refresh();
