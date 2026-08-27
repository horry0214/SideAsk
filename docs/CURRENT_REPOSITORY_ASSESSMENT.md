# Current Repository Assessment

评估基线：SideAsk MVP v0.1.2，2026-08-27。

## 当前目录与架构

```text
sideask-mvp/
├── extension/          Manifest V3 原生 JS/CSS 扩展
├── server/             Node.js 零依赖本地网关
├── docs/               初版架构与路线图
└── README.md
```

运行链路为：网页 Content Script → `chrome.runtime` 长连接 → Extension Service Worker → `127.0.0.1:8787` 本地网关 → MiniMax OpenAI-compatible API。

## 已实现并可保留的能力

- Chrome / Edge Manifest V3 基础结构。
- 2–500 字划词检测与 `✦ 解释` 入口。
- 当前块、前一块、后一块的有限上下文提取。
- 浮窗快捷提问、多轮追问与纯文本流式渲染。
- MiniMax CN、MiniMax Global 环境变量切换；CN Token Plan Key 类型识别。
- `chrome.storage.local` 最近 50 条本地历史。
- Anchor 恢复顺序符合产品原则：Live Range → selector + text → 全文 text lookup → scrollY。
- Content Script 不持有 API Key；服务只监听 loopback。

## 技术债与明显问题

### P0

- Provider 请求、模型参数、SSE 解析与错误处理全部耦合在 `server.mjs`，无法安全扩展 Provider。
- 上游错误正文会被写入日志并原样返回 UI，错误体验不稳定，也可能暴露不必要的供应商细节。
- Context Extractor 没有系统排除密码、表单、编辑器和显式敏感区域。
- 缺少自动化测试、语法检查脚本和 Provider stream parser 的回归样例。

### P1

- Manifest 名称仍为 `SideAsk MVP`，没有正式图标、canonical brand asset 与统一 design token。
- 浮窗 Logo 是字母占位符；Slogan 没有进入产品 UI。
- Accessibility 不完整：划词入口不是 button、缺少 dialog 语义、Esc 与 focus 管理。

### P2+

- 历史记录仍是扁平 session，并以 `URL + selectedText` 去重；无法表达 parent-child branch 或同概念的多次证据。
- `我懂了` 只是布尔值，没有 `unclear/review` 状态，也不会沉淀 KnowledgeItem。
- 没有 IndexedDB schema/migration、Provider 设置 UI、ChatGPT Adapter 或 Knowledge Base。

## 安全与隐私结论

做得正确的部分：仓库没有真实 Key；`.env` 被忽略；服务只绑定 `127.0.0.1`；API Key 不进入 Content Script。

首轮必须修复的部分：上下文敏感区域排除、URL query/hash 清理、错误归一化与日志降敏。`<all_urls>` 是核心能力所需的高权限，但发布前应在 README 和商店说明中明确用途，并评估可选的按站点授权模式。

## 与产品设计的主要差距

当前版本验证了 Side Question 与 Return-to-context，但尚未建立 Learning Branch、KnowledgeItem、WeaknessItem、Provider Registry、Provider Settings 和 IndexedDB。正确演进方式是保留现有可运行链路，先建立可测试的 Provider 边界与品牌基线，再迁移数据模型。

## 本轮决策

1. 保留原生 JS、无构建、Local Gateway 的 MVP 形态。
2. 先抽离 Provider Registry、OpenAI-compatible stream normalizer 和 error normalizer。
3. 保留 MiniMax 既有环境变量与 Token Plan 行为，确保向后兼容。
4. 将批准的 Logo 原图作为 canonical asset，并从同一资产生成扩展图标。
5. 知识模型先写成稳定文档契约，不在本轮引入 IndexedDB 或知识图谱。
