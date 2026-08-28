# SideAsk 隐私说明

SideAsk v0.6.0 是 local-first 浏览器扩展与 VS Code Companion，没有账户、遥测、广告 SDK 或由 SideAsk 运营的云数据库。

## 同意与网页访问

首次使用时，SideAsk 会在读取网页内容之前展示产品内数据说明。普通 HTTP/HTTPS 网页的自动划词能力属于可选浏览器权限：用户只会在设置引导中主动授予，也可以从同一页面撤销。若尚未确认说明，点击扩展工具栏图标只会打开设置引导，不会向网页注入 SideAsk。

## 本地保存

- Provider 配置与 API Key。
- 最近支线提问、消息与来源 Anchor。
- 用户主动选择的收藏。

浏览器最近记录保存在扩展私有 IndexedDB；Provider 配置只在 Gateway 的本机 Vault 保存一次，API Key 使用 AES-256-GCM 与独立随机本机密钥加密。浏览器与 VS Code 只能获得脱敏元数据。旧浏览器和 VS Code Provider 记录只进行一次性、非破坏迁移。

## 发送给 Provider

- 用户主动选择的文本。
- 当前可读块和少量前后内容。
- 在用户保留单次“附带附近代码”选项时，VS Code 编辑器中数量受限的附近行。
- 用户先主动复制、再运行“询问剪贴板内容”的文字。
- 当前支线最近消息。
- 去除 username/password/query/hash 的来源 URL。

只有当用户主动划词并要求解释或发送追问后，这些内容才会从扩展传给同一台电脑上的 loopback-only SideAsk Gateway，再由 Gateway 发送给用户自己配置的 AI Provider。Provider 请求使用其 HTTPS endpoint；该 Provider 会依据其自身条款与隐私政策处理内容。

## 默认排除

密码字段、input、textarea、select、contenteditable、textbox、显式 private/sensitive 节点、脚本/样式、整页浏览记录、其它对话历史、完整 VS Code 工作区，以及另一个扩展的 Webview 内容。SideAsk 不会检查 Codex Chat；剪贴板入口必须由用户主动复制并运行命令。

## 权限用途

- `storage`：保存界面语言与迁移元数据。
- `scripting` 与 `activeTab`：让用户可以通过工具栏在当前页面显式打开 SideAsk。
- `http://127.0.0.1:8787/*` 与 `http://localhost:8787/*`：连接本地 Gateway。
- 普通 HTTP/HTTPS 网页访问：可选权限，只会在用户阅读数据说明后从首次引导页申请。

VS Code Companion 只注册命令、编辑器右键入口、快捷键、本地设置和 Webview 面板。只有用户运行划词命令时才读取编辑器选区，只有用户运行剪贴板命令时才读取剪贴板。

## 控制与删除

共享 Provider 可以从浏览器管理页或 VS Code 删除，变更会同时作用于两个入口。网页访问权可以在首次使用引导中撤销。移除某个客户端会清理其客户端本地状态；共享 Vault 会保留在用户应用数据目录，直到用户主动删除。已经发送给用户所选 AI Provider 的数据，适用该 Provider 自身的保留与删除机制。

## 有限使用

SideAsk 仅将网页内容与其他用户数据用于商店介绍所说明的支线提问、返回原文、最近记录与收藏功能；不会出售数据、用于广告，也不会允许 SideAsk 维护者读取这些内容。SideAsk 对浏览器 API 信息的使用遵守 Chrome Web Store User Data Policy（包括 Limited Use 要求）。
