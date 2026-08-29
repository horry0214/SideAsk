# SideAsk Local Gateway

The Gateway is the small local companion required by the SideAsk browser extension. It has no production dependencies and listens only on `127.0.0.1:8787`.

## Start

1. Install Node.js 20 or newer.
2. Extract this ZIP.
3. Open a terminal in the extracted folder.
4. Run:

```bash
npm start
```

Keep the terminal open while using SideAsk. The extension's first-run guide will change the Gateway step to **Connected**.

Provider configuration is entered from either the SideAsk browser dashboard or desktop overlay and stored once in the Gateway's encrypted on-device Vault. Both clients share the same saved Providers and default model; neither client can retrieve a saved API key. No SideAsk account or cloud sync is involved.

On Windows the Vault is normally stored under `%APPDATA%\SideAsk`; macOS and Linux use their standard per-user application-data directories. Keep this directory private. As an alternative or fallback for local development, copy `server/.env.example` to `server/.env` and fill the desired values. Never publish or share that file.

Project: https://github.com/horry0214/sideask
