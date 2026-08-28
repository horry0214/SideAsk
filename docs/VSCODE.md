# SideAsk VS Code Companion

The VS Code Companion is the first non-browser SideAsk surface. It is intentionally not an IDE agent: Codex and other coding agents keep ownership of project changes and long-running tasks, while SideAsk resolves a temporary question without contaminating that main conversation.

## Install

1. Download or build `sideask-vscode-0.6.0.vsix`.
2. In VS Code, open **Extensions → … → Install from VSIX…**.
3. Start the shared Local Gateway from the SideAsk repository:

   ```bash
   npm start
   ```

4. Run **SideAsk: Configure Provider**, or use a Provider already configured by the browser extension. The 25-profile catalog and encrypted on-device Provider Vault are shared by both surfaces.

## Entry points

### Editor selection

Select code or text and press `Alt+Shift+A` on Windows/Linux or `Cmd+Alt+A` on macOS. The editor context menu and Command Palette expose the same **SideAsk: Ask about Selection** command.

SideAsk includes the selection, its file/language identity, and at most the configured number of surrounding lines. The nearby context checkbox can remove those lines from an individual request.

### Codex Chat, terminals, and other extension views

VS Code Webviews run in isolated contexts. SideAsk therefore does not inspect another extension's UI or selection. Copy the intended text and run **SideAsk: Ask about Clipboard** instead.

## Commands

| Command | Purpose |
| --- | --- |
| `SideAsk: Ask about Selection` | Start a side question from the active editor selection. |
| `SideAsk: Ask about Clipboard` | Start from copied text, including text copied from Codex Chat or a terminal. |
| `SideAsk: Open SideAsk` | Reopen the current panel. |
| `SideAsk: New Side Question` | Clear only the temporary conversation. |
| `SideAsk: Configure Provider` | Select, add, edit, or delete Providers shared with the browser extension. |

## Build

```bash
cd vscode-extension
npm install
npm test
npm run package
```

The package is written to `dist/sideask-vscode-0.6.0.vsix`.
