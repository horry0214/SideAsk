# Contributing to SideAsk

[English](CONTRIBUTING.md) · [简体中文](CONTRIBUTING.zh-CN.md)

Thanks for helping SideAsk make side questions useful without breaking the reader's main thread. The project values working, testable behavior over framework churn or abstraction count.

## Development setup

Requirements: Node.js 20+. The repository has no package dependencies.

```bash
npm run check
```

Load `extension/` as an unpacked extension in Chrome or Edge. After changing extension code, reload it from the extensions page and refresh the test page.

## Contribution principles

1. Start with the user problem and keep each change focused.
2. Preserve selection, streaming, anchors, MiniMax Token Plan support, and data migrations.
3. Keep provider differences inside the Provider layer; do not add vendor condition chains to Core.
4. Never commit API keys, real conversations, browsing history, private page content, or sensitive URLs.
5. Include an explicit migration strategy for persistent schema changes.
6. Keep the UI quiet, minimal, accessible, and context-preserving.
7. Update tests and documentation whenever behavior changes.

## Before opening a pull request

- Run `npm run check`.
- Smoke-test the affected flow in Chrome or Edge; use both when browser behavior is relevant.
- Confirm no `.env`, key, token, log, personal data, or private content entered the diff.
- Update the README, changelog, or relevant design document.
- Normalize new provider errors without returning raw upstream response text.

Use a concise conventional commit such as `feat(storage): add branch migration` or `fix(stream): reject empty answers`.
