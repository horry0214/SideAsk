# SideAsk for VS Code

**Select anywhere in your editor. Ask in place. Keep Codex working.**

SideAsk opens a focused side-question panel for the code or text you select. It does not modify files, run commands, or add noise to the main conversation in Codex or another coding agent.

## Use it

1. Start SideAsk Local Gateway from the repository with `npm start`.
2. Run **SideAsk: Configure Provider**, or configure a Provider once from the browser extension. Both surfaces use the same local Vault.
3. Select code or prose in an editor.
4. Press `Alt+Shift+A` on Windows/Linux (`Cmd+Alt+A` on macOS), or choose **SideAsk: Ask about Selection** from the editor context menu.
5. Choose **Simple**, **Example**, **Why it matters**, or **Find the issue**, then continue with a follow-up.

Text inside Codex Chat, terminals, and other extension Webviews cannot be read reliably by another VS Code extension. Copy that text, then run **SideAsk: Ask about Clipboard**.

## Privacy

- SideAsk sends only the deliberate selection, a bounded number of nearby lines, and the active side conversation.
- Nearby lines can be disabled before each request.
- Provider configuration is encrypted by SideAsk Local Gateway and shared with the browser extension on this computer.
- Saved API keys are never returned to either client; they are resolved inside the Gateway by `providerId`.
- Requests go through the loopback-only SideAsk Local Gateway.
- There is no SideAsk account, telemetry, or cloud sync.

## Install a local VSIX

Open **Extensions → … → Install from VSIX…**, select `sideask-vscode-0.6.0.vsix`, then reload VS Code if prompted.

Project and source code: <https://github.com/horry0214/sideask>
