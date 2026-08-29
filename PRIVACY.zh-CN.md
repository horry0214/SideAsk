# SideAsk 隐私说明

SideAsk v0.7 是 local-first 浏览器扩展与 Windows 桌面悬浮窗，没有账户、遥测、广告 SDK 或由 SideAsk 运营的云数据库。

## 同意与网页访问

首次使用时，SideAsk 会在读取网页内容之前展示产品内数据说明。普通 HTTP/HTTPS 网页的自动划词能力属于可选浏览器权限：用户只会在设置引导中主动授予，也可以从同一页面撤销。若尚未确认说明，点击扩展工具栏图标只会打开设置引导，不会向网页注入 SideAsk。

## 本地保存

- Provider 配置与 API Key。
- 最近支线提问、消息与来源 Anchor。
- 用户主动选择的收藏。

浏览器最近记录保存在扩展私有 IndexedDB；Provider 配置只在 Gateway 的本机 Vault 保存一次，API Key 使用 AES-256-GCM 与独立随机本机密钥加密。浏览器与桌面端只能获得脱敏元数据。旧浏览器 Provider 记录只进行一次性、非破坏迁移。

## 发送给 Provider

- 用户主动选择的文本。
- 当前可读块和少量前后内容。
- 当前支线最近消息。
- 去除 username/password/query/hash 的来源 URL。

只有当用户主动要求解释选区或发送追问后，这些内容才会传给同一台电脑上的 loopback-only SideAsk Gateway，再由 Gateway 发送给用户自己配置的 AI Provider。桌面端开启“划词后显示解释按钮”时，SideAsk 会通过 Windows UI Automation 确认并读取非空文字选区；普通拖动不会触发自动 `Ctrl+C`。只有用户点击 **✦ 解释** 后才会发送给 Gateway 或 Provider。Provider 请求使用其 HTTPS endpoint；该 Provider 会依据其自身条款与隐私政策处理内容。

## 默认排除

密码字段、input、textarea、select、contenteditable、textbox、显式 private/sensitive 节点、脚本/样式、整页浏览记录、其它对话历史、原生应用的周围内容、屏幕图像和全局剪贴板历史。桌面悬浮窗无法检查另一个应用的整份文档或对话，只接收 Windows UI Automation 已确认的文字选区，或用户显式按下全局快捷键后复制的选区。

## 权限用途

- `storage`：保存界面语言与迁移元数据。
- `scripting` 与 `activeTab`：让用户可以通过工具栏在当前页面显式打开 SideAsk。
- `http://127.0.0.1:8787/*` 与 `http://localhost:8787/*`：连接本地 Gateway。
- 普通 HTTP/HTTPS 网页访问：可选权限，只会在用户阅读数据说明后从首次引导页申请。

Windows 桌面端会注册一个全局快捷键。可选的“划词后显示解释按钮”会在 SideAsk 运行时启用本机鼠标选区监听；拖选或双击后，它只在 Windows UI Automation 确认存在文字选区时显示按钮，系统不支持时不会自动复制。它忽略 SideAsk 自己的窗口并且默认关闭，不记录按键、截图、鼠标轨迹或剪贴板历史。

## 控制与删除

共享 Provider 可以从浏览器管理页或桌面设置删除，变更会同时作用于两个入口。网页访问权可以在首次使用引导中撤销；桌面划词按钮也可以在设置或托盘菜单中关闭。移除某个客户端会清理其客户端本地状态；共享 Vault 会保留在用户应用数据目录，直到用户主动删除。已经发送给用户所选 AI Provider 的数据，适用该 Provider 自身的保留与删除机制。

## 有限使用

SideAsk 仅将网页内容与其他用户数据用于商店介绍所说明的支线提问、返回原文、最近记录与收藏功能；不会出售数据、用于广告，也不会允许 SideAsk 维护者读取这些内容。SideAsk 对浏览器 API 信息的使用遵守 Chrome Web Store User Data Policy（包括 Limited Use 要求）。
