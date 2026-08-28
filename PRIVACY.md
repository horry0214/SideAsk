# SideAsk Privacy

[English](PRIVACY.md) · [简体中文](PRIVACY.zh-CN.md)

SideAsk v0.4.0 is a local-first browser extension with no account system, telemetry, advertising SDK, or SideAsk-operated cloud database.

## Consent and website access

On first use, SideAsk displays an in-product disclosure before it reads page content. Automatic selection support on HTTP and HTTPS websites is an optional browser permission that the user grants from the setup guide and can revoke from the same guide. Clicking the toolbar icon without this consent opens the setup guide instead of injecting SideAsk into the page.

## Stored locally

- Provider configuration and API keys.
- Recent side questions, messages, and source anchors.
- Favorites explicitly chosen by the user.

This data stays in extension-private IndexedDB. Legacy `sideaskHistory` is read only for a one-time, non-destructive migration.

## Sent to your provider

- Text you deliberately select.
- The current readable block and small neighboring snippets.
- Recent messages from the active side branch.
- A source URL stripped of username, password, query, and hash.

These items are sent only after a user deliberately selects text and asks SideAsk to explain it or sends a follow-up. They travel from the extension to the loopback-only SideAsk Gateway on the same computer, and from there to the AI Provider configured by the user. Provider requests use the Provider's HTTPS endpoint. The Provider processes this content under its own terms and privacy policy.

## Excluded by default

Password fields, inputs, textareas, selects, editable regions, textbox roles, explicitly private or sensitive nodes, scripts, styles, full-page browsing history, and unrelated conversation history.

## Permissions

- `storage` stores locale preferences and migration metadata in extension-local storage.
- `scripting` and `activeTab` let the user open SideAsk explicitly on the current page.
- Access to `http://127.0.0.1:8787/*` and `http://localhost:8787/*` is required to reach the local Gateway.
- Access to ordinary HTTP and HTTPS websites is optional and is requested only from the first-run guide after the data disclosure.

## Control and deletion

Provider entries can be deleted individually in the dashboard. Website access can be revoked from the first-run guide. Removing the SideAsk browser extension clears its extension-local storage. Data already sent to a user's chosen AI Provider is governed by that Provider's retention and deletion controls.

## Limited use

SideAsk uses page content and other user data only to provide the user-facing side-question, source-return, recent-history, and favorites features described in its listing. It does not sell data, use it for advertising, or allow the SideAsk maintainers to read it. SideAsk's use of information received through browser APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.
