# Updating SideAsk

[简体中文](UPDATING.zh-CN.md) · [English](UPDATING.md)

SideAsk v0.7 combines the browser extension, a standalone Windows desktop overlay, and the local Gateway. The v0.6 VS Code Companion has been removed. Provider profiles and encrypted API keys live in the Gateway's on-device Vault; browser recent questions, favorites, and source anchors remain in extension-private storage. Gateway environment fallbacks may live in `server/.env`.

## v0.6 migration

Start the v0.6 or newer Gateway before opening Provider settings. The browser extension imports legacy browser Provider records into the shared Vault once, without deleting the old records. If the same Provider already exists, SideAsk reuses it instead of creating a duplicate. Configure or switch the default in the browser or desktop app and the other surface sees the change immediately.

The shared Vault is normally stored under `%APPDATA%\SideAsk` on Windows, `~/Library/Application Support/SideAsk` on macOS, and `$XDG_CONFIG_HOME/sideask` or `~/.config/sideask` on Linux. It survives extension reloads and desktop folder replacement. Do not copy or sync this directory as a substitute for account sync.

## Know when a release is available

Open the repository's [Releases page](https://github.com/horry0214/sideask/releases), then choose **Watch → Custom → Releases** on GitHub. You will receive release notifications without subscribing to every commit.

## Chrome Web Store or Edge Add-ons

Store installations update automatically after a new package passes review and is published. To request a check immediately:

- Chrome: open `chrome://extensions/`, enable **Developer mode**, then choose **Update**.
- Edge: open `edge://extensions/`, enable **Developer mode**, then choose **Update**.

If an update adds new permissions, the browser may ask you to approve them before re-enabling the extension.

## Git clone installation

1. Stop the running Gateway with `Ctrl+C`.
2. Check whether you have local changes with `git status`. Commit or preserve your own changes before pulling.
3. Update and verify:

~~~bash
git pull --ff-only origin main
npm run check
npm start
~~~

4. Open `chrome://extensions/` or `edge://extensions/` and choose **Reload** on SideAsk.
5. Open SideAsk Settings and confirm that the displayed extension version is the expected release.
6. Open `http://127.0.0.1:8787/health` and confirm that the Gateway responds with `"ok": true`.

## Windows desktop overlay

SideAsk Anywhere for Windows is currently distributed as a portable folder rather than an in-place installer. Quit SideAsk from its tray menu, download the new Windows x64 ZIP, extract it to a temporary directory, and replace the entire old application folder. Do not copy only `SideAsk.exe`; the matching DLL, UI, runtime, and license folders are part of the version.

The encrypted Provider Vault and desktop preference under `%APPDATA%\SideAsk` are outside the application folder and remain in place. After the update, run `SideAsk.exe`, select text in another app, press `Alt+Shift+A`, and confirm the provider badge and streamed answer. If **Show Explain after selecting text** is enabled, also drag-select a phrase, click the small **✦ Explain** button, and confirm that the overlay opens. Verify the checksum before running an unsigned preview build.

## Downloaded ZIP / Load unpacked installation

1. Download the matching extension and Gateway archives from the [latest release](https://github.com/horry0214/sideask/releases/latest).
2. Stop the running Gateway. Back up `server/.env` if you created one.
3. Extract the new archives to a temporary folder.
4. Replace the files inside your existing SideAsk extension and Gateway folders. Keep the extension folder at the same absolute path whenever possible; loading it from a different path can create a different unpacked extension ID and therefore a separate local storage area.
5. Restore `server/.env`, if applicable, and restart the Gateway with `npm start`.
6. Open the browser extensions page and choose **Reload** on SideAsk.
7. Verify the extension version and Gateway health as described above.

Do not paste API keys into repository files, issue reports, or release comments. Saved Provider keys belong in the Gateway Vault; environment-only secrets should stay in the ignored `server/.env` file.

## Troubleshooting

- **Old UI after updating:** reload SideAsk on the browser extensions page, then reload the web page where you use it.
- **Gateway version still looks old:** stop every SideAsk Gateway process using ports `8787` and `8788`, then start it again from the updated folder.
- **Provider settings appear missing:** start the v0.6 Gateway, then reopen Provider settings so migration can retry. For browser history, also confirm that the unpacked extension is loaded from the same folder as before; a different unpacked extension ID owns a separate history database.
- **Pull refuses to continue:** preserve local changes first; do not use destructive Git reset commands just to update.

See [CHANGELOG.md](CHANGELOG.md) for release-by-release changes.
