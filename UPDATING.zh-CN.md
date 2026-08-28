# 更新 SideAsk

[简体中文](UPDATING.zh-CN.md) · [English](UPDATING.md)

SideAsk 包含浏览器扩展与本地 Gateway，两部分应尽量使用同一个版本。Provider Key、最近提问、收藏和来源 Anchor 保存在扩展私有存储中；Gateway 环境配置可能保存在 `server/.env`。

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

## 下载 ZIP / 加载已解压扩展

1. 从[最新 Release](https://github.com/horry0214/sideask/releases/latest)下载匹配的扩展包和 Gateway 包。
2. 停止旧 Gateway；如果创建过 `server/.env`，先备份该文件。
3. 把新版压缩包解压到临时目录。
4. 用新版文件覆盖现有 SideAsk 扩展与 Gateway 文件夹中的内容。扩展目录应尽量保持原来的绝对路径；换到新路径重新加载可能产生不同的开发版扩展 ID，从而使用另一份本地存储。
5. 如有需要，恢复 `server/.env`，然后运行 `npm start` 重启 Gateway。
6. 进入浏览器扩展管理页，在 SideAsk 卡片上点击“重新加载”。
7. 按上面的方式确认扩展版本和 Gateway 健康状态。

不要把 API Key 粘贴到仓库文件、Issue 或 Release 评论中。浏览器 Provider Key 应继续保存在 SideAsk 设置中；仅供 Gateway 使用的秘密应放在已被 Git 忽略的 `server/.env`。

## 常见问题

- **更新后仍显示旧界面：**先在浏览器扩展管理页重新加载 SideAsk，再刷新正在使用的网页。
- **Gateway 仍像旧版本：**停止所有占用 `8787` 和 `8788` 端口的 SideAsk Gateway，再从更新后的目录启动。
- **Provider 设置不见了：**检查扩展是否仍从原文件夹加载；旧配置通常仍属于此前的扩展 ID。
- **Git 拒绝拉取：**先保存自己的本地修改，不要为了更新而执行破坏性的 Git reset。

每个版本的具体变化见 [CHANGELOG.md](CHANGELOG.md)。
