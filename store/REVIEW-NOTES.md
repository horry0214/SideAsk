# Reviewer Instructions

SideAsk is an open-source, local-first BYOK extension. AI requests require the separately packaged SideAsk Local Gateway and a reviewer-provided API key for a supported remote Provider, or a reviewer-run local Ollama/LM Studio server. Provider credentials are encrypted in the Gateway's on-device Vault and the extension receives only redacted metadata. No shared test credential is embedded in the extension or submission package.

## Test flow

1. Install the submitted extension ZIP.
2. The first-run guide opens automatically.
3. Read the data disclosure and click **I understand — continue**.
4. Download `sideask-gateway.zip` from the latest GitHub release, extract it, and run `npm start` with Node.js 20 or newer. The Gateway has no production dependencies to install and listens only on `127.0.0.1:8787`.
5. Return to the guide and click **Check again**. The Gateway card changes to Connected.
6. Click **Add Provider**, choose one of the 25 presets, enter a reviewer-owned API key when required, then choose **Test and fetch models**. Select a returned model and save the Provider. MiniMax CN is a simple remote test option; Ollama and LM Studio support keyless local review.
7. Return to the setup tab, click **Enable on websites**, and approve the optional HTTP/HTTPS host permission.
8. Click **Try your first selection**. On the bundled practice page, select the words `phi node`, release the mouse, and click **Explain**.
9. The real SideAsk floating panel streams the Provider answer. Use **Favorite** if the answer is worth revisiting, then open SideAsk to inspect Recent and Favorites.

## Security notes

- No remote executable code is used.
- The page content script never receives a Provider API key.
- Removing a Provider from the dashboard also removes it from the shared local Vault used by the optional VS Code Companion.
- The Gateway rejects ordinary webpage POST origins and accepts extension-origin requests.
- Passwords, forms, editable regions, explicitly sensitive nodes, and URL credentials/query/hash are excluded from context capture.
- Website access is optional and revocable from the first-run guide.
