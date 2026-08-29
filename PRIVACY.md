# SideAsk Privacy

[English](PRIVACY.md) · [简体中文](PRIVACY.zh-CN.md)

SideAsk v0.7 is a local-first browser extension and Windows desktop overlay with no account system, telemetry, advertising SDK, or SideAsk-operated cloud database.

## Consent and website access

On first use, SideAsk displays an in-product disclosure before it reads page content. Automatic selection support on HTTP and HTTPS websites is an optional browser permission that the user grants from the setup guide and can revoke from the same guide. Clicking the toolbar icon without this consent opens the setup guide instead of injecting SideAsk into the page.

## Stored locally

- Provider configuration and API keys.
- Recent side questions, messages, and source anchors.
- Favorites explicitly chosen by the user.

Recent browser data stays in extension-private IndexedDB. Provider configuration is stored once in the Gateway's on-device Vault; API keys are encrypted with AES-256-GCM and a separate random local key. Browser and desktop clients receive only redacted metadata. Legacy browser Provider records are imported through a one-time, non-destructive migration.

## Sent to your provider

- Text you deliberately select.
- The current readable block and small neighboring snippets.
- Recent messages from the active side branch.
- A source URL stripped of username, password, query, and hash.

These items are sent only after a user deliberately asks SideAsk to explain a selection or sends a follow-up. With the desktop option **Show Explain after selecting text**, SideAsk uses Windows UI Automation to confirm and read a non-empty text selection; ordinary drags do not receive an automatic `Ctrl+C`. Nothing is sent to the Gateway or Provider until the user clicks **✦ Explain**. Requests travel to the loopback-only SideAsk Gateway on the same computer, and from there to the AI Provider configured by the user. Provider requests use the Provider's HTTPS endpoint. The Provider processes this content under its own terms and privacy policy.

## Excluded by default

Password fields, inputs, textareas, selects, editable regions, textbox roles, explicitly private or sensitive nodes, scripts, styles, full-page browsing history, unrelated conversation history, native-app surrounding content, screen images, and global clipboard history. The desktop overlay cannot inspect another app's full document or conversation; it receives only a text selection confirmed by Windows UI Automation, or a selection copied after the user explicitly invokes the global shortcut.

## Permissions

- `storage` stores locale preferences and migration metadata in extension-local storage.
- `scripting` and `activeTab` let the user open SideAsk explicitly on the current page.
- Access to `http://127.0.0.1:8787/*` and `http://localhost:8787/*` is required to reach the local Gateway.
- Access to ordinary HTTP and HTTPS websites is optional and is requested only from the first-run guide after the data disclosure.

The Windows desktop overlay registers a global shortcut. Its optional **Show Explain after selecting text** setting installs a local mouse-selection listener while SideAsk is running. After a drag or double-click, it displays the button only when Windows UI Automation confirms a text selection; it does not automatically copy when accessibility support is unavailable. The listener ignores SideAsk's own window, is disabled by default, and does not record keystrokes, screenshots, cursor history, or clipboard history.

## Control and deletion

Shared Provider entries can be deleted from the browser dashboard or desktop settings; the change applies to both surfaces. Website access can be revoked from the first-run guide, and the desktop selection button can be disabled in Settings or from the tray menu. Removing a client clears its client-local state, while the shared Vault remains in the user's application-data directory until the user deletes it. Data already sent to a chosen AI Provider is governed by that Provider's retention and deletion controls.

## Limited use

SideAsk uses page content and other user data only to provide the user-facing side-question, source-return, recent-history, and favorites features described in its listing. It does not sell data, use it for advertising, or allow the SideAsk maintainers to read it. SideAsk's use of information received through browser APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.
