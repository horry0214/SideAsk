# SideAsk Desktop Overlay

[简体中文](DESKTOP.zh-CN.md) · [English](DESKTOP.md)

SideAsk Desktop is the lightweight Windows companion for places where a browser extension cannot reach: VS Code, PDFs, native apps, terminals, and ordinary desktop text. It floats over the current app instead of opening another editor column or changing your main AI conversation.

## Use SideAsk Anywhere for Windows

1. Download the Windows x64 ZIP and extract the **whole** `SideAsk` folder.
2. Run `SideAsk.exe`. Keep the DLL, `runtime`, `ui`, `generated`, `assets`, and `licenses` folders beside it.
3. Select text in any app and press `Alt+Shift+A`.
4. SideAsk copies the selection, opens beside the pointer, and starts a short explanation. Use the quick prompts or continue in the input box.
5. Choose **Return to app**, press `Esc`, or click away to hide it. Use the tray icon to reopen or quit.

For the browser-style flow, open Settings and enable **Show Explain after selecting text**. After a mouse drag or double-click, SideAsk first asks Windows UI Automation to confirm that the foreground app has a non-empty text selection. Only then does it show **✦ Explain**. Ordinary drags do not trigger it or receive an automatic `Ctrl+C`; apps without accessible text-selection support can still use the global shortcut. The Provider request begins only after you click the button.

When both clients are installed, **Prefer the browser extension on webpages** is enabled by default. Chrome, Edge, Firefox, Brave, and other browsers show only the extension's selection button, while Desktop handles VS Code, PDF readers, terminals, and other native apps, avoiding duplicate Explain buttons. `Alt+Shift+A` always forces Desktop; turn the setting off if you also want its automatic button inside browsers.

The Windows package is not code-signed yet, so Windows SmartScreen may identify it as an unrecognized app. Verify the download against the release checksum before running it. Windows 10/11 x64 and the Microsoft Edge WebView2 Runtime are required; current Windows installations normally already include WebView2.

## One Provider configuration on this computer

The desktop overlay and Chrome/Edge extension both use `http://127.0.0.1:8787` and the encrypted Provider Vault under `%APPDATA%\SideAsk`. If the browser Gateway is already running, Desktop reuses it. Otherwise Desktop starts its bundled loopback Gateway and Node.js runtime with no visible terminal.

Configure a Provider from the desktop gear button or from the browser Settings page. The default Provider changes immediately for every local SideAsk client. A new key exists in the password field only while you enter and save it; saved API keys are never returned to the WebView by the configuration API.

Desktop verifies both Gateway health and the shared Provider API before reusing a running loopback service. If a legacy Gateway owns the port, it reports an actionable upgrade message instead of exposing a generic `Not found` error.

## Privacy boundary

Desktop sends the text deliberately selected by the user and messages in the active small conversation. The optional selection button is off by default; when enabled, it asks Windows UI Automation for a confirmed text selection after a mouse drag or double-click and does not probe ordinary drags with `Ctrl+C`. It does not contact the Gateway or Provider until **✦ Explain** is clicked. Default browser-first routing reads only the foreground window's process name, not webpage content. Desktop cannot inspect surrounding content in another native app. The browser extension can still add a bounded nearby paragraph because it runs inside the page.

There is no SideAsk account, cloud sync, global clipboard history, screen capture, or background document indexing.

## Build on Windows

Requirements: Windows 10/11 x64, PowerShell 5+, Node.js 20+, .NET Framework 4.8, and WebView2 Runtime.

~~~powershell
npm run desktop:test
npm run package:desktop
~~~

The build downloads the official Microsoft WebView2 SDK into an ignored local cache, compiles the WPF host with the Windows .NET Framework compiler, prepares the existing Gateway, and writes `dist-desktop-native/SideAsk`. The release folder bundles Node.js so end users do not need to install it separately.

The desktop host is MIT-licensed. Bundled Node.js and WebView2 license and notice files are included under `licenses/`.
