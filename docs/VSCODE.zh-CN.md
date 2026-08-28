# SideAsk VS Code Companion

VS Code Companion 是 SideAsk 的第一个非浏览器入口。它刻意不做 IDE Agent：Codex 等编程 Agent 继续负责修改项目和执行长任务，SideAsk 只解决一个临时卡点，不污染当前主对话。

## 安装

1. 下载或构建 `sideask-vscode-0.6.0.vsix`。
2. 在 VS Code 打开 **扩展 → … → 从 VSIX 安装…**。
3. 在 SideAsk 仓库启动共用的 Local Gateway：

   ```bash
   npm start
   ```

4. 运行 **SideAsk: 配置 Provider**，或者直接使用浏览器插件已经配置的 Provider。25 个预设与本机加密 Provider Vault 由两个入口共用。

## 两种入口

### 编辑器划词

选中代码或文字，在 Windows/Linux 按 `Alt+Shift+A`，macOS 按 `Cmd+Alt+A`；右键菜单和命令面板也提供 **SideAsk: 询问选中内容**。

SideAsk 会携带选区、文件/语言标识，以及设置中指定数量的附近代码。每次发送前都可以关闭“附带附近代码”。

### Codex Chat、终端和其他扩展界面

VS Code Webview 运行在隔离环境中，因此 SideAsk 不会检查另一个扩展的界面或选区。请复制目标内容，再运行 **SideAsk: 询问剪贴板内容**。

## 命令

| 命令 | 用途 |
| --- | --- |
| `SideAsk: 询问选中内容` | 从当前编辑器选区开始一条支线。 |
| `SideAsk: 询问剪贴板内容` | 询问从 Codex Chat、终端等位置复制的内容。 |
| `SideAsk: 打开 SideAsk` | 重新打开当前面板。 |
| `SideAsk: 新建支线问题` | 只清空当前临时对话。 |
| `SideAsk: 配置 Provider` | 选择、添加、编辑或删除与浏览器插件共用的 Provider。 |

## 构建

```bash
cd vscode-extension
npm install
npm test
npm run package
```

安装包输出到 `dist/sideask-vscode-0.6.0.vsix`。
