# SideAsk Architecture

## 当前可运行架构

```text
Web Page / ChatGPT
  ├── Selection Detector
  ├── Generic Context Extractor
  ├── Anchor Manager
  └── Floating UI
          │ chrome.runtime Port
          ▼
Extension Service Worker
          │ loopback HTTP stream
          ▼
SideAsk Local Gateway :8787
  ├── Prompt Builder
  ├── Provider Registry
  ├── Request Normalizer
  ├── Stream Normalizer
  └── Error Normalizer
          │
          ▼
Configured Provider
```

当前仍使用原生 JS/CSS 和 Node.js 内置模块，不需要构建或安装依赖。这个约束让 P0 回归成本保持最低。

## Windows Desktop Overlay（v0.7）

```text
Global shortcut ──────────────┐
Mouse drag / double-click ────┴─ local selection copy
                                      │
                         optional ✦ Explain cue
                                      │ user clicks
                                      ▼
                          WebView2 floating overlay
                                      │
                                      ▼
                         SideAsk Local Gateway :8787
                                      │
                                      ▼
                            Configured Provider
```

桌面端使用 WPF 管理全局快捷键、可选鼠标选区监听、托盘和窗口行为，界面由系统 WebView2 Runtime 渲染。快捷键会直接读取主动选区并打开悬浮窗；可选模式只在鼠标拖选或双击后显示 **✦ 解释**，用户点击后才向 Gateway 发送选区。桌面端不读取另一个应用的附近内容、不截屏，也不保存全局剪贴板历史。

浏览器与桌面端通过配置接口管理共享 `providerId`，但聊天请求默认不携带 Provider 凭据；Gateway 在内部解析共享默认 Provider。Provider 元数据与 AES-256-GCM 密文由 Local Provider Vault 保存；没有共享 Provider 时才回退到 `server/.env`。旧浏览器 IndexedDB Provider 会进行一次性、非破坏迁移。

## 运行边界

### Extension Content Script

负责选择检测、附近上下文、Anchor、浮窗交互和本地历史。它不能读取或保存 API Key，也不能直接包含供应商分支逻辑。

### Extension Service Worker

负责把 Content Script 的长连接桥接到 loopback gateway，并作为扩展私有 IndexedDB 历史数据的唯一 API。Provider 管理请求直接代理到 Gateway Vault，聊天只引用共享默认 Provider，不向 Content Script 暴露 Key。

### Local Gateway

负责本机加密 Provider Vault、构造最小必要 prompt、选择 Provider、归一化 request/stream/error，并避免向 UI 暴露 Key 或原始上游错误。Vault 使用独立随机密钥与 AES-256-GCM 密文，文件位于用户应用数据目录；Gateway 只监听 loopback，配置接口只返回脱敏元数据，POST 只接受 JSON，并拒绝普通网页 Origin。

### Provider

Provider 通过 Registry 注册。Core 只依赖统一接口，不使用 `if (provider === ...)` 分支。25 个预设由 `extension/provider-catalog.js` 单一来源驱动；Anthropic 使用原生 Messages adapter，其余官方兼容服务、本地模型与自定义端点复用 OpenAI-compatible adapter。

## Context Builder

当前预算是字符级上限，优先级为：

```text
Selected text
> Current readable block
> Previous / next sibling snippets
> Recent branch messages
```

发送前排除 `input`、`textarea`、`select`、password、contenteditable、textbox、脚本/样式和显式 sensitive/private 节点。URL 只保留 origin + pathname。

未来引入 Adapter：

```text
PageAdapter
├── ChatGPTAdapter
└── GenericDOMAdapter
```

Adapter 只改变 Context 选择策略，不改变数据和 Provider 协议。

## Anchor Manager

序列化保存 URL/title、selectedText、prefix、suffix、selector、scrollY 和 createdAt。恢复顺序必须保持：

```text
Live DOM Range
→ selector + selected text
→ text + prefix/suffix lookup
→ scrollY fallback
```

当前全文 lookup 尚未利用 prefix/suffix 消歧，是后续 Anchor hardening 的明确任务。

## Storage

当前使用 extension-origin、带明确 version migration 的 IndexedDB：

```text
settings, legacy providers, sessions, branches,
knowledge, weaknesses, reviews
```

Service Worker 首次启动会读取旧 `chrome.storage.local.sideaskHistory`，转换为 LearningSession/LearningBranch，并写入 `legacyHistoryMigrated` 标记。旧 Provider 会与共享 Vault 中的记录按类型、Base URL 和模型合并，并写入 `sharedProviderVaultMigratedV1`；旧数据不会在迁移过程中删除。

## 渐进模块边界

```text
extension/             产品壳、管理页与 IndexedDB storage
server/providers/      本轮建立的 Provider 边界
packages/context/      规模增长后再迁移
packages/storage/      IndexedDB 落地时再迁移
packages/knowledge/    Knowledge consolidation 落地时再迁移
```

在模块数量和复用需求出现前，不为 monorepo 目录纯度搬迁可工作的代码。
