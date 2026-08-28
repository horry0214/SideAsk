# SideAsk 隐私说明

SideAsk v0.4.0 是 local-first 浏览器扩展，没有账户、遥测、广告 SDK 或由 SideAsk 运营的云数据库。

## 同意与网页访问

首次使用时，SideAsk 会在读取网页内容之前展示产品内数据说明。普通 HTTP/HTTPS 网页的自动划词能力属于可选浏览器权限：用户只会在设置引导中主动授予，也可以从同一页面撤销。若尚未确认说明，点击扩展工具栏图标只会打开设置引导，不会向网页注入 SideAsk。

## 本地保存

- Provider 配置与 API Key。
- 最近支线提问、消息与来源 Anchor。
- 用户主动选择的收藏。

这些数据保存在浏览器扩展私有 IndexedDB。旧 `sideaskHistory` 只用于一次性非破坏迁移。

## 发送给 Provider

- 用户主动选择的文本。
- 当前可读块和少量前后内容。
- 当前支线最近消息。
- 去除 username/password/query/hash 的来源 URL。

只有当用户主动划词并要求解释或发送追问后，这些内容才会从扩展传给同一台电脑上的 loopback-only SideAsk Gateway，再由 Gateway 发送给用户自己配置的 AI Provider。Provider 请求使用其 HTTPS endpoint；该 Provider 会依据其自身条款与隐私政策处理内容。

## 默认排除

密码字段、input、textarea、select、contenteditable、textbox、显式 private/sensitive 节点、脚本/样式、整页浏览记录和其它对话历史。

## 权限用途

- `storage`：保存界面语言与迁移元数据。
- `scripting` 与 `activeTab`：让用户可以通过工具栏在当前页面显式打开 SideAsk。
- `http://127.0.0.1:8787/*` 与 `http://localhost:8787/*`：连接本地 Gateway。
- 普通 HTTP/HTTPS 网页访问：可选权限，只会在用户阅读数据说明后从首次引导页申请。

## 控制与删除

Provider 可在管理页逐条删除；网页访问权可以在首次使用引导中撤销。移除 SideAsk 浏览器扩展会清除扩展本地存储。已经发送给用户所选 AI Provider 的数据，适用该 Provider 自身的保留与删除机制。

## 有限使用

SideAsk 仅将网页内容与其他用户数据用于商店介绍所说明的支线提问、返回原文、最近记录与收藏功能；不会出售数据、用于广告，也不会允许 SideAsk 维护者读取这些内容。SideAsk 对浏览器 API 信息的使用遵守 Chrome Web Store User Data Policy（包括 Limited Use 要求）。
