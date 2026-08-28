const vscode = require("vscode");
const { buildEditorSource, buildClipboardSource, cleanQuestion } = require("./context");
const { GatewayClient } = require("./gateway");
const { PROVIDER_CATALOG, getProviderProfile } = require("./provider-catalog");

const PROVIDER_STATE_KEY = "sideask.provider.v1";
const PROVIDER_SECRET_KEY = "sideask.provider.apiKey.v1";
const RESPONSE_TIMEOUT_MS = 120_000;

const COPY = {
  en: {
    noSelection: "Select some code or text first.",
    emptyClipboard: "The clipboard does not contain any text.",
    providerDefault: "Gateway environment default",
    chooseProvider: "Choose a shared Provider or manage the local Vault",
    sharedProviders: "Shared on this computer",
    manageProviders: "Manage",
    addProvider: "Add shared Provider",
    editProvider: "Edit shared Provider",
    deleteProvider: "Delete shared Provider",
    chooseSavedProvider: "Choose a saved Provider",
    baseUrl: "Provider Base URL",
    model: "Model ID",
    apiKey: "API Key (encrypted by SideAsk Local Gateway)",
    apiKeyKeep: "Leave blank to keep the existing API Key",
    apiKeyRequired: "Enter an API Key.",
    valueRequired: "This value is required.",
    providerDeleted: "Shared Provider deleted.",
    providerDefaultUpdated: name => `${name} is now the shared default.`,
    deleteConfirm: name => `Delete ${name} for both the browser and VS Code?`,
    gatewayOffline: "Cannot reach SideAsk Local Gateway.",
    providerReady: name => `${name} is shared locally and ready.`,
    unknownError: "SideAsk could not complete the request.",
    stopped: "Stopped",
    timeout: "The request timed out. Try again or choose a faster model.",
    freeQuestion: "Free side question"
  },
  "zh-CN": {
    noSelection: "请先在编辑器中选中一段代码或文字。",
    emptyClipboard: "剪贴板中没有可用的文字。",
    providerDefault: "Gateway 环境默认配置",
    chooseProvider: "选择共享 Provider，或管理本机 Vault",
    sharedProviders: "这台电脑上的共享配置",
    manageProviders: "管理",
    addProvider: "添加共享 Provider",
    editProvider: "编辑共享 Provider",
    deleteProvider: "删除共享 Provider",
    chooseSavedProvider: "选择已保存的 Provider",
    baseUrl: "Provider Base URL",
    model: "模型 ID",
    apiKey: "API Key（由 SideAsk Local Gateway 加密保存）",
    apiKeyKeep: "留空以保留已保存的 API Key",
    apiKeyRequired: "请输入 API Key。",
    valueRequired: "此项不能为空。",
    providerDeleted: "共享 Provider 已删除。",
    providerDefaultUpdated: name => `${name} 已成为浏览器与 VS Code 的共享默认项。`,
    deleteConfirm: name => `为浏览器与 VS Code 同时删除 ${name}？`,
    gatewayOffline: "无法连接 SideAsk Local Gateway。",
    providerReady: name => `${name} 已在本机共享，可以开始提问。`,
    unknownError: "SideAsk 暂时无法完成请求。",
    stopped: "已停止",
    timeout: "请求超时，请重试或选择响应更快的模型。",
    freeQuestion: "自由支线提问"
  }
};

function currentLocale() {
  const configured = vscode.workspace.getConfiguration("sideask").get("language", "auto");
  if (configured === "zh-CN" || configured === "en") return configured;
  return String(vscode.env.language || "").toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function copy() {
  return COPY[currentLocale()] || COPY.en;
}

function gatewayClient() {
  const url = vscode.workspace.getConfiguration("sideask").get("gatewayUrl", "http://127.0.0.1:8787");
  return new GatewayClient(url);
}

async function sharedProvider() {
  try {
    const state = await gatewayClient().listProviders();
    return state.providers?.find(provider => provider.id === state.defaultProviderId) || null;
  } catch {
    return null;
  }
}

async function clearLegacyProvider(context) {
  await Promise.all([
    context.globalState.update(PROVIDER_STATE_KEY, undefined),
    context.secrets.delete(PROVIDER_SECRET_KEY)
  ]);
}

async function chooseProviderProfile(text) {
  const picked = await vscode.window.showQuickPick(PROVIDER_CATALOG.map(profile => ({
    label: profile.displayName,
    description: profile.defaultModel,
    detail: profile.defaultBaseUrl,
    profile
  })), {
    title: "SideAsk",
    placeHolder: text.addProvider,
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true
  });
  return picked?.profile || null;
}

async function chooseStoredProvider(providers, text) {
  const picked = await vscode.window.showQuickPick((providers || []).map(provider => ({
    label: provider.displayName,
    description: provider.model,
    detail: getProviderProfile(provider.type)?.displayName || provider.type,
    provider
  })), {
    title: "SideAsk",
    placeHolder: text.chooseSavedProvider,
    ignoreFocusOut: true
  });
  return picked?.provider || null;
}

async function configureProvider(context, manager) {
  await migrateLegacyProvider(context);
  const text = copy();
  const client = gatewayClient();
  let state;
  try {
    state = await client.listProviders();
  } catch (error) {
    vscode.window.showErrorMessage(error instanceof Error ? error.message : text.gatewayOffline);
    return;
  }

  const items = [];
  if (state.providers?.length) {
    items.push({ label: text.sharedProviders, kind: vscode.QuickPickItemKind.Separator });
    items.push(...state.providers.map(provider => ({
      label: provider.displayName,
      description: provider.id === state.defaultProviderId ? "✓" : provider.model,
      detail: `${getProviderProfile(provider.type)?.displayName || provider.type} · ${provider.model}`,
      action: "default",
      provider
    })));
  }
  items.push(
    { label: text.manageProviders, kind: vscode.QuickPickItemKind.Separator },
    { label: `$(add) ${text.addProvider}`, action: "add" },
    ...(state.providers?.length ? [
      { label: `$(edit) ${text.editProvider}`, action: "edit" },
      { label: `$(trash) ${text.deleteProvider}`, action: "delete" }
    ] : [])
  );

  const picked = await vscode.window.showQuickPick(items, {
    title: "SideAsk",
    placeHolder: text.chooseProvider,
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true
  });
  if (!picked) return;
  if (picked.action === "default") {
    await client.setDefaultProvider(picked.provider.id);
    vscode.window.showInformationMessage(text.providerDefaultUpdated(picked.provider.displayName));
    manager.refresh();
    return;
  }
  if (picked.action === "delete") {
    const target = await chooseStoredProvider(state.providers, text);
    if (!target) return;
    const confirmed = await vscode.window.showWarningMessage(
      text.deleteConfirm(target.displayName),
      { modal: true },
      text.deleteProvider,
    );
    if (confirmed !== text.deleteProvider) return;
    await client.deleteProvider(target.id);
    vscode.window.showInformationMessage(text.providerDeleted);
    manager.refresh();
    return;
  }

  let existing = null;
  if (picked.action === "edit") {
    existing = await chooseStoredProvider(state.providers, text);
    if (!existing) return;
  }
  const profile = existing ? getProviderProfile(existing.type) : await chooseProviderProfile(text);
  if (!profile) return;
  const baseUrl = await vscode.window.showInputBox({
    title: `${profile.displayName} · ${text.baseUrl}`,
    value: existing?.baseUrl || profile.defaultBaseUrl,
    prompt: text.baseUrl,
    ignoreFocusOut: true,
    validateInput: value => value.trim() ? null : text.valueRequired
  });
  if (baseUrl === undefined) return;
  const model = await vscode.window.showInputBox({
    title: `${profile.displayName} · ${text.model}`,
    value: existing?.model || profile.defaultModel,
    prompt: text.model,
    ignoreFocusOut: true,
    validateInput: value => value.trim() ? null : text.valueRequired
  });
  if (model === undefined) return;

  let apiKey = "";
  if (profile.apiKeyRequired) {
    const entered = await vscode.window.showInputBox({
      title: `${profile.displayName} · ${text.apiKey}`,
      prompt: existing?.apiKeyConfigured ? text.apiKeyKeep : text.apiKey,
      password: true,
      ignoreFocusOut: true,
      validateInput: value => (value.trim() || existing?.apiKeyConfigured) ? null : text.apiKeyRequired
    });
    if (entered === undefined) return;
    apiKey = entered.trim();
  }

  const saved = await client.saveProvider({
    ...(existing ? { id: existing.id } : {}),
    type: profile.id,
    displayName: existing?.displayName || profile.displayName,
    baseUrl: baseUrl.trim(),
    model: model.trim(),
    apiKey
  });
  manager.refresh();
  try {
    await client.testProvider(saved.id);
    vscode.window.showInformationMessage(text.providerReady(saved.displayName));
  } catch (error) {
    vscode.window.showWarningMessage(error instanceof Error ? error.message : text.gatewayOffline);
  }
}

async function migrateLegacyProvider(context) {
  const metadata = context.globalState.get(PROVIDER_STATE_KEY);
  if (!metadata?.id) return false;
  const profile = getProviderProfile(metadata.id);
  if (!profile) return false;
  const apiKey = await context.secrets.get(PROVIDER_SECRET_KEY);
  try {
    const client = gatewayClient();
    const state = await client.listProviders();
    let matching = state.providers?.find(provider => provider.type === profile.id
      && provider.model === (metadata.model || profile.defaultModel)
      && provider.baseUrl === (metadata.baseUrl || profile.defaultBaseUrl));
    if (!matching) {
      matching = await client.saveProvider({
        type: profile.id,
        displayName: metadata.displayName || profile.displayName,
        baseUrl: metadata.baseUrl || profile.defaultBaseUrl,
        model: metadata.model || profile.defaultModel,
        apiKey: apiKey || ""
      });
      if (!state.defaultProviderId) await client.setDefaultProvider(matching.id);
    }
    await clearLegacyProvider(context);
    return true;
  } catch {
    return false;
  }
}

class SideAskPanelManager {
  constructor(context) {
    this.context = context;
    this.panel = null;
    this.ready = false;
    this.source = this.emptySource();
    this.messages = [];
    this.activeRequest = null;
    this.messageSequence = 0;
  }

  emptySource() {
    return {
      kind: "free",
      selectedText: "",
      context: "",
      sourceTitle: copy().freeQuestion,
      sourceUri: "",
      languageId: "text",
      range: null,
      nearbyLines: 0
    };
  }

  async openSource(source) {
    this.stop();
    this.source = source || this.emptySource();
    this.messages = [];
    this.ensurePanel();
    this.panel.reveal(vscode.ViewColumn.Beside, false);
    await this.postState();
  }

  async open() {
    this.ensurePanel();
    this.panel.reveal(vscode.ViewColumn.Beside, false);
    await this.postState();
  }

  ensurePanel() {
    if (this.panel) return;
    const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, "media");
    this.panel = vscode.window.createWebviewPanel(
      "sideask.chat",
      "SideAsk",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [mediaRoot]
      }
    );
    this.panel.iconPath = vscode.Uri.joinPath(mediaRoot, "sideask-icon.svg");
    this.panel.webview.html = this.webviewHtml(this.panel.webview, mediaRoot);
    this.panel.onDidDispose(() => {
      this.stop();
      this.panel = null;
      this.ready = false;
    }, null, this.context.subscriptions);
    this.panel.webview.onDidReceiveMessage(message => this.handleMessage(message), null, this.context.subscriptions);
  }

  async handleMessage(message) {
    if (!message?.type) return;
    if (message.type === "ready") {
      this.ready = true;
      await this.postState();
      return;
    }
    if (message.type === "ask") {
      await this.ask(message.question, message.includeContext !== false);
      return;
    }
    if (message.type === "cancel") {
      this.stop();
      return;
    }
    if (message.type === "new") {
      this.stop();
      this.messages = [];
      await this.postState();
      return;
    }
    if (message.type === "configure") {
      await configureProvider(this.context, this);
      return;
    }
    if (message.type === "revealSource") {
      await this.revealSource();
      return;
    }
    if (message.type === "clipboard") {
      await vscode.commands.executeCommand("sideask.askClipboard");
    }
  }

  async ask(rawQuestion, includeContext) {
    const question = cleanQuestion(rawQuestion);
    if (!question || this.activeRequest) return;

    const userMessage = { id: `m${++this.messageSequence}`, role: "user", content: question };
    const assistantMessage = { id: `m${++this.messageSequence}`, role: "assistant", content: "", streaming: true };
    this.messages.push(userMessage, assistantMessage);
    const controller = new AbortController();
    const request = { controller, assistantMessage, stopped: false, timedOut: false };
    const timeout = setTimeout(() => {
      request.timedOut = true;
      controller.abort();
    }, RESPONSE_TIMEOUT_MS);
    this.activeRequest = request;
    await this.postState();
    const payload = {
      selection: this.source.selectedText,
      context: includeContext ? this.source.context : "",
      sourceTitle: this.source.sourceTitle,
      sourceUrl: "",
      locale: currentLocale(),
      messages: this.messages
        .filter(item => item.role === "user" || (item.role === "assistant" && item.content))
        .slice(-12)
        .map(item => ({ role: item.role, content: item.content }))
    };

    try {
      await gatewayClient().chat(payload, {
        signal: controller.signal,
        onDelta: delta => {
          assistantMessage.content += delta;
          this.post({ type: "streamDelta", id: assistantMessage.id, delta });
        }
      });
      assistantMessage.streaming = false;
      this.post({ type: "streamDone", id: assistantMessage.id });
    } catch (error) {
      const stopped = Boolean(this.activeRequest?.stopped);
      const timedOut = Boolean(this.activeRequest?.timedOut);
      assistantMessage.streaming = false;
      if (!assistantMessage.content && stopped) assistantMessage.content = copy().stopped;
      const message = stopped
        ? copy().stopped
        : (timedOut ? copy().timeout : (error instanceof Error ? error.message : copy().unknownError));
      if (!assistantMessage.content) assistantMessage.content = message;
      this.post({ type: "streamError", id: assistantMessage.id, message, stopped });
    } finally {
      clearTimeout(timeout);
      this.activeRequest = null;
      this.refreshStatus();
    }
  }

  stop() {
    if (!this.activeRequest) return;
    this.activeRequest.stopped = true;
    this.activeRequest.controller.abort();
  }

  async revealSource() {
    if (!this.source.sourceUri || !this.source.range) return;
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(this.source.sourceUri));
      const editor = await vscode.window.showTextDocument(document, { preview: false });
      const start = new vscode.Position(this.source.range.start.line, this.source.range.start.character);
      const end = new vscode.Position(this.source.range.end.line, this.source.range.end.character);
      editor.selection = new vscode.Selection(start, end);
      editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    } catch (error) {
      vscode.window.showWarningMessage(error instanceof Error ? error.message : copy().unknownError);
    }
  }

  async postState() {
    if (!this.panel || !this.ready) return;
    const provider = await sharedProvider();
    this.post({
      type: "state",
      locale: currentLocale(),
      source: this.source,
      messages: this.messages,
      streaming: Boolean(this.activeRequest),
      provider: provider
        ? { displayName: provider.displayName, model: provider.model, configured: true }
        : { displayName: copy().providerDefault, model: "", configured: false }
    });
    this.refreshStatus();
  }

  async refreshStatus() {
    if (!this.panel || !this.ready) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const health = await gatewayClient().health(controller.signal);
      this.post({
        type: "gateway",
        online: true,
        service: health.service,
        provider: health.displayName,
        model: health.model
      });
    } catch {
      this.post({ type: "gateway", online: false });
    } finally {
      clearTimeout(timeout);
    }
  }

  refresh() {
    this.postState();
  }

  post(message) {
    if (this.panel && this.ready) this.panel.webview.postMessage(message);
  }

  webviewHtml(webview, mediaRoot) {
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "main.css"));
    const markdownUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "markdown.js"));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "main.js"));
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "sideask-icon.svg"));
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
  <link rel="stylesheet" href="${cssUri}">
  <title>SideAsk</title>
</head>
<body>
  <header class="topbar">
    <div class="brand"><img src="${iconUri}" alt=""><div><strong>SideAsk</strong><span data-i18n="tagline"></span></div></div>
    <div class="top-actions">
      <button class="icon-button" id="new-button" type="button" data-i18n-title="new" aria-label="New">＋</button>
      <button class="icon-button" id="provider-button" type="button" data-i18n-title="provider" aria-label="Provider">⚙</button>
    </div>
  </header>
  <main>
    <section class="source-card">
      <div class="eyebrow-row"><span class="eyebrow" data-i18n="selected"></span><button id="reveal-source" class="text-button" type="button" data-i18n="backToSource"></button></div>
      <div id="source-title" class="source-title"></div>
      <pre id="selection" class="selection"></pre>
      <button id="clipboard-button" class="empty-source" type="button" hidden><span>⌘</span><b data-i18n="useClipboard"></b><small data-i18n="clipboardHint"></small></button>
    </section>
    <section class="quick-actions" aria-label="Quick actions">
      <button type="button" data-prompt="simple" data-i18n="simple"></button>
      <button type="button" data-prompt="example" data-i18n="example"></button>
      <button type="button" data-prompt="why" data-i18n="why"></button>
      <button type="button" data-prompt="debug" data-i18n="debug"></button>
    </section>
    <section id="messages" class="messages" aria-live="polite"></section>
  </main>
  <footer>
    <form id="composer" class="composer">
      <textarea id="question" rows="1" maxlength="4000" data-i18n-placeholder="placeholder"></textarea>
      <button id="send" class="send" type="submit" data-i18n-title="send">↑</button>
    </form>
    <div class="footer-meta">
      <label class="context-toggle"><input id="include-context" type="checkbox" checked><span data-i18n="includeContext"></span></label>
      <button id="provider-status" class="provider-status" type="button"><i></i><span></span></button>
    </div>
  </footer>
  <script src="${markdownUri}"></script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function activate(context) {
  const manager = new SideAskPanelManager(context);
  migrateLegacyProvider(context).then(migrated => {
    if (migrated) manager.refresh();
  });
  const askSelection = async () => {
    const editor = vscode.window.activeTextEditor;
    const surroundingLines = vscode.workspace.getConfiguration("sideask").get("surroundingLines", 18);
    const source = buildEditorSource(editor, {
      surroundingLines,
      asRelativePath: uri => vscode.workspace.asRelativePath(uri, false)
    });
    if (!source) {
      vscode.window.showInformationMessage(copy().noSelection);
      return;
    }
    await manager.openSource(source);
  };
  const askClipboard = async () => {
    const source = buildClipboardSource(await vscode.env.clipboard.readText(), currentLocale());
    if (!source) {
      vscode.window.showInformationMessage(copy().emptyClipboard);
      return;
    }
    await manager.openSource(source);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("sideask.askSelection", askSelection),
    vscode.commands.registerCommand("sideask.askClipboard", askClipboard),
    vscode.commands.registerCommand("sideask.openPanel", () => manager.open()),
    vscode.commands.registerCommand("sideask.configureProvider", () => configureProvider(context, manager)),
    vscode.commands.registerCommand("sideask.newConversation", async () => {
      manager.messages = [];
      manager.stop();
      await manager.open();
    }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration("sideask")) manager.refresh();
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
