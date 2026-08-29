# Security Policy

[English](SECURITY.md) · [简体中文](SECURITY.zh-CN.md)

## Supported version

Only the latest SideAsk MVP release is actively maintained. Security fixes are not guaranteed to be backported to older release archives.

## Reporting a vulnerability

Use a [GitHub Private Security Advisory](https://github.com/horry0214/sideask/security/advisories/new). Do not open a public issue containing API keys, provider responses, private page content, browsing history, or identifiable user data.

Include the affected version, a minimal reproduction, impact, and a suggested mitigation when possible. Replace all credentials and private content with safe placeholders.

## Current security boundary

- The gateway binds only to `127.0.0.1`.
- POST endpoints accept JSON and reject ordinary `http(s)` page origins.
- Provider keys are encrypted in the Gateway's on-device Vault with a separate random local key, or remain in the user's local `.env` fallback.
- Browser and desktop configuration clients receive only redacted Provider metadata.
- The content script never receives a provider key.
- Logs contain only provider id, normalized error code, and HTTP status.
- Raw upstream error bodies are not returned to the UI.

Do not expose the SideAsk gateway to a LAN or the public internet. Create least-privilege keys in official provider consoles and rotate a key immediately if exposure is suspected.
