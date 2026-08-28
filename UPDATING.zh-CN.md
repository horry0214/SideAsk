# 更新 SideAsk

[简体中文](UPDATING.zh-CN.md) · [English](UPDATING.md)

SideAsk v0.6 包含三个协同部分：浏览器扩展、可选的 VS Code Companion，以及本地 Gateway。Provider 配置与加密 API Key 保存在 Gateway 的本机 Vault；浏览器最近提问、收藏与来源 Anchor 仍在扩展私有存储中。Gateway 的环境变量回退配置可放在 `server/.env`。

## v0.6 迁移说明

先启动 v0.6 Gateway，再打开 Provider 设置。浏览器扩展和 VS Code Companion 会把旧 Provider 记录一次性导入共享 Vault，但不会删除旧记录；如果 Vault 中已经存在相同 Provider，会直接复用而不是重复创建。此后在任一客户端配置或切换默认 Provider，另一端都会立即看到变化。

共享 Vault 默认位于：Windows 的 `%APPDATA%\SideAsk`、macOS 的 `~/Library/Application Support/SideAsk`、Linux 的 `$XDG_CONFIG_HOME/sideask` 或 `~/.config/sideask`。它不会因重新加载扩展或升级 VSIX 而消失。不要把同步这个目录当作账户同步方案。

## 如何收到版本通知

打开仓库的 [Releases 页面](https://github.com/horry0214/sideask/releases)，然后在 GitHub 选择 **Watch → Custom → Releases**。这样可以收到新版本通知，而不必订阅每一次代码提交。

## 从 Chrome Web Store 或 Edge Add-ons 安装

新版本通过审核并发布后，商店安装的扩展会自动更新。需要立即检查时：

- Chrome：打开 `chrome://extensions/`，开启“开发者模式”，然后点击“更新”。
- Edge：打开 `edge://extensions/`，开启“开发人员模式”，然后点击“更新”。

如果新版本增加了权限，浏览器可能会要求确认后才重新启用扩展。

## 通过 Git Clone 安装

1. 在 Gateway 终端按 `Ctrl+C` 停止旧服务。
2. 运行 `git status` 检查是否有自己的修改；拉取前请先提交或妥善保留这些修改。
3. 更新、验证并重新启动：

~~~bash
git pull --ff-only origin main
npm run check
npm start
~~~

4. 打开 `chrome://extensions/` 或 `edge://extensions/`，在 SideAsk 卡片上点击“重新加载”。
5. 打开 SideAsk 设置，确认显示的扩展版本符合预期。
6. 打开 `http://127.0.0.1:8787/health`，确认 Gateway 返回 `"ok": true`。

## VS Code Companion

从同一个 GitHub Release 下载 `sideask-vscode-0.6.0.vsix`，然后在 VS Code 打开 **扩展 → … → 从 VSIX 安装…**。安装新版 VSIX 会原位升级已有 SideAsk Companion。重启同一个 v0.6 Gateway，再运行 **SideAsk: 打开支线面板**，确认界面显示共享 Provider。

## 下载 ZIP / 加载已解压扩展

1. 从[最新 Release](https://github.com/horry0214/sideask/releases/latest)下载匹配的扩展包和 Gateway 包。
2. 停止旧 Gateway；如果创建过 `server/.env`，先备份该文件。
3. 把新版压缩包解压到临时目录。
4. 用新版文件覆盖现有 SideAsk 扩展与 Gateway 文件夹中的内容。扩展目录应尽量保持原来的绝对路径；换到新路径重新加载可能产生不同的开发版扩展 ID，从而使用另一份本地存储。
5. 如有需要，恢复 `server/.env`，然后运行 `npm start` 重启 Gateway。
6. 进入浏览器扩展管理页，在 SideAsk 卡片上点击“重新加载”。
7. 按上面的方式确认扩展版本和 Gateway 健康状态。

不要把 API Key 粘贴到仓库文件、Issue 或 Release 评论中。已保存 Provider Key 应进入 Gateway Vault；只供环境变量使用的秘密应放在已被 Git 忽略的 `server/.env`。

## 常见问题

- **更新后仍显示旧界面：**先在浏览器扩展管理页重新加载 SideAsk，再刷新正在使用的网页。
- **Gateway 仍像旧版本：**停止所有占用 `8787` 和 `8788` 端口的 SideAsk Gateway，再从更新后的目录启动。
- **Provider 设置不见了：**先启动 v0.6 Gateway，再重新打开 Provider 设置让迁移重试。浏览器历史仍与扩展 ID 绑定，因此也要检查扩展是否从原文件夹加载。
- **Git 拒绝拉取：**先保存自己的本地修改，不要为了更新而执行破坏性的 Git reset。

每个版本的具体变化见 [CHANGELOG.md](CHANGELOG.md)。
