# Updating SideAsk

[简体中文](UPDATING.zh-CN.md) · [English](UPDATING.md)

SideAsk has two parts that should be kept on the same release: the browser extension and the local Gateway. Provider keys, recent questions, favorites, and source anchors live in extension-private storage; Gateway environment settings may live in `server/.env`.

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

## Downloaded ZIP / Load unpacked installation

1. Download the matching extension and Gateway archives from the [latest release](https://github.com/horry0214/sideask/releases/latest).
2. Stop the running Gateway. Back up `server/.env` if you created one.
3. Extract the new archives to a temporary folder.
4. Replace the files inside your existing SideAsk extension and Gateway folders. Keep the extension folder at the same absolute path whenever possible; loading it from a different path can create a different unpacked extension ID and therefore a separate local storage area.
5. Restore `server/.env`, if applicable, and restart the Gateway with `npm start`.
6. Open the browser extensions page and choose **Reload** on SideAsk.
7. Verify the extension version and Gateway health as described above.

Do not paste API keys into repository files, issue reports, or release comments. Browser Provider keys should remain in SideAsk Settings; Gateway-only secrets should stay in the ignored `server/.env` file.

## Troubleshooting

- **Old UI after updating:** reload SideAsk on the browser extensions page, then reload the web page where you use it.
- **Gateway version still looks old:** stop every SideAsk Gateway process using ports `8787` and `8788`, then start it again from the updated folder.
- **Provider settings appear missing:** confirm that the unpacked extension is loaded from the same folder as before. The old settings normally still belong to the previous extension ID.
- **Pull refuses to continue:** preserve local changes first; do not use destructive Git reset commands just to update.

See [CHANGELOG.md](CHANGELOG.md) for release-by-release changes.
