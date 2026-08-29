(() => {
  const webview = window.chrome?.webview;
  if (!webview || window.sideaskDesktop) return;

  const pending = new Map();
  const listeners = new Map();
  let sequence = 0;

  function post(message) {
    webview.postMessage(message);
  }

  function invoke(method, ...args) {
    const id = `${Date.now()}-${sequence += 1}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`SideAsk native request timed out: ${method}`));
      }, 45_000);
      pending.set(id, { resolve, reject, timer });
      post({ kind: "invoke", id, method, args });
    });
  }

  function send(method, ...args) {
    post({ kind: "send", method, args });
  }

  function on(name, callback) {
    const callbacks = listeners.get(name) || [];
    callbacks.push(callback);
    listeners.set(name, callbacks);
  }

  webview.addEventListener("message", event => {
    const message = event.data || {};
    if (message.kind === "reply") {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.ok) request.resolve(message.result);
      else request.reject(new Error(message.error || "SideAsk native request failed."));
      return;
    }
    if (message.kind === "event") {
      for (const callback of listeners.get(message.name) || []) callback(message.payload);
    }
  });

  window.sideaskDesktop = {
    ready: () => invoke("desktop:ready"),
    hide: () => invoke("desktop:hide"),
    togglePin: () => invoke("desktop:toggle-pin"),
    setAutoCapture: value => invoke("desktop:set-auto-capture", value),
    setWindowMode: mode => invoke("desktop:set-window-mode", mode),
    setBusy: value => invoke("desktop:set-busy", value),
    startDrag: () => send("desktop:start-drag"),
    startResize: edge => send("desktop:start-resize", edge),
    openExternal: url => invoke("desktop:open-external", url),
    listProviders: () => invoke("providers:list"),
    saveProvider: provider => invoke("providers:save", provider),
    setDefaultProvider: providerId => invoke("providers:default", providerId),
    deleteProvider: providerId => invoke("providers:delete", providerId),
    testProvider: payload => invoke("providers:test", payload),
    startChat: (requestId, payload) => send("chat:start", requestId, payload),
    cancelChat: requestId => send("chat:cancel", requestId),
    onCapture: callback => on("selection:capture", callback),
    onChatEvent: callback => on("chat:event", callback),
    onDesktopState: callback => on("desktop:state", callback),
  };
})();
