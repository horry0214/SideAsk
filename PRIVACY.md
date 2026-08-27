# SideAsk Privacy

[English](PRIVACY.md) · [简体中文](PRIVACY.zh-CN.md)

SideAsk v0.2.5 is a local-first browser extension with no account system, telemetry, advertising SDK, or cloud database.

## Stored locally

- Provider configuration and API keys.
- Learning Sessions, Learning Branches, messages, and source anchors.
- Knowledge Items, Weakness Items, and understanding status.

This data stays in extension-private IndexedDB. Legacy `sideaskHistory` is read only for a one-time, non-destructive migration.

## Sent to your provider

- Text you deliberately select.
- The current readable block and small neighboring snippets.
- Recent messages from the active side branch.
- A source URL stripped of username, password, query, and hash.

## Excluded by default

Password fields, inputs, textareas, selects, editable regions, textbox roles, explicitly private or sensitive nodes, scripts, styles, full-page browsing history, and unrelated conversation history.

Provider entries can be deleted individually in the dashboard. Removing the SideAsk browser extension clears its extension-local storage.
