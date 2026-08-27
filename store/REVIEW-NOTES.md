# Reviewer Instructions

SideAsk is an open-source, local-first BYOK extension. AI requests require the separately packaged SideAsk Local Gateway and a reviewer-provided API key for MiniMax or an OpenAI-compatible endpoint. No shared test credential is embedded in the extension or submission package.

## Test flow

1. Install the submitted extension ZIP.
2. The first-run guide opens automatically.
3. Read the data disclosure and click **I understand — continue**.
4. Download `sideask-gateway.zip` from the latest GitHub release, extract it, and run `npm start` with Node.js 20 or newer. The Gateway has no production dependencies to install and listens only on `127.0.0.1:8787`.
5. Return to the guide and click **Check again**. The Gateway card changes to Connected.
6. Click **Add Provider**, choose MiniMax CN, MiniMax Global, or Custom OpenAI-compatible, enter a reviewer-owned API key and model, save it, and optionally run **Test connection**.
7. Return to the setup tab, click **Enable on websites**, and approve the optional HTTP/HTTPS host permission.
8. Click **Try your first selection**. On the bundled practice page, select the words `phi node`, release the mouse, and click **Explain**.
9. The real SideAsk floating panel streams the Provider answer. Use **Got it** or **Still fuzzy**, then open the dashboard to inspect the locally saved Learning Branch.

## Security notes

- No remote executable code is used.
- The page content script never receives a Provider API key.
- The Gateway rejects ordinary webpage POST origins and accepts extension-origin requests.
- Passwords, forms, editable regions, explicitly sensitive nodes, and URL credentials/query/hash are excluded from context capture.
- Website access is optional and revocable from the first-run guide.
