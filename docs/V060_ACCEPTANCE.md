# SideAsk v0.6.0 SideAsk Anywhere Acceptance

Release date: 2026-08-28

## Automated acceptance

- Root syntax, repository integrity, privacy, prompt, streaming, Provider, storage, and Vault tests pass with `npm run check`.
- VS Code context, Markdown, Gateway client, and package checks pass.
- Browser manifest, root package, and VS Code package all report `0.6.0`.
- Chrome, Edge, Gateway, and VSIX release artifacts build from the committed source.

## Browser acceptance

- Selecting deliberate, non-sensitive page text opens the SideAsk entry and streams sanitized Markdown.
- Quick prompts, follow-ups, Recent, Favorites, and return-to-source remain operational.
- Provider add, edit, test, default, and delete operations use the Gateway Vault.
- Legacy browser Provider records migrate non-destructively when the v0.6 Gateway is available.

## VS Code acceptance

- `Alt+Shift+A` asks about the active editor selection in an independent side panel without editing the file.
- **SideAsk: Ask about Clipboard** accepts explicit copies from Codex Chat, terminals, and other isolated views.
- Streaming Markdown, quick prompts, follow-ups, cancellation, new conversation, and reveal-source work in the Webview.
- Nearby-line context is bounded and configurable; another extension's Webview is never inspected.

## Shared Provider acceptance

- A Provider saved from VS Code appears in the browser, and a default selected in the browser appears in VS Code.
- The configuration API returns redacted metadata and never returns saved API keys.
- API keys are AES-256-GCM ciphertext at rest with a separate random local key; no plaintext key appears in `provider-vault.json`.
- Existing browser IndexedDB and VS Code Secret Storage Provider records migrate once without deleting legacy data.
- Without a Vault default, existing `server/.env` Provider fallback remains compatible.

## Privacy and scope

- Gateway binds to loopback and rejects ordinary webpage origins for API operations.
- Browser and VS Code send only deliberate selection or clipboard input, bounded nearby context, active side-question messages, and sanitized source metadata.
- SideAsk adds no account, telemetry, cloud database, cross-device sync, conversation import, knowledge graph, or automatic inspection of other extensions.
