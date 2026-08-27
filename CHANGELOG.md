# Changelog

## 0.3.0 MVP — 2026-08-28

### Added

- English-first GitHub README with a linked Simplified Chinese edition.
- Real SideAsk interface screenshots, a six-scenario overview, and an expanded bilingual visual product introduction.
- Persistent English / Simplified Chinese switching across the dashboard and page-side floating panel.
- Locale-aware quick prompts and Gateway system prompts so the answer language follows the interface.
- A 23-second real-interface walkthrough GIF for the GitHub project page.
- MIT License and GitHub issue / pull request templates for the public repository.

## 0.2.5 MVP — 2026-08-27

### Fixed

- Provider 流结束但没有回答正文时返回明确错误，不再把空响应当成成功。
- 浮窗增加请求超时、扩展后台断连和空回答兜底，并恢复输入控件状态。
- Gateway 只在收到第一段有效回答后开始响应，空流可返回结构化错误。
- MiniMax `max_completion_tokens` 调整为官方接口允许的 2048。

## 0.2.4 MVP — 2026-08-27

### Fixed

- 将悬浮窗和右下角入口 Logo 从内联 SVG 改为独立扩展 SVG 资源，避免宿主网页 CSS 隐藏 Logo path。
- 为 Logo 图片增加高优先级尺寸与显示隔离规则。
- 移除网页右下角入口的灰色投影。

## 0.2.3 MVP — 2026-08-27

### Fixed

- 按产品方确认的正确 Logo，恢复开放式紫色双弧 S 与左下圆点。
- 移除悬浮窗标题栏和网页右下角入口中的深色方形应用底板。
- 调整小尺寸标识的比例、留白和右下角网页背景承托。

## 0.2.2 MVP — 2026-08-27

### Fixed

- 悬浮窗标题栏和网页右下角入口统一为品牌板中的小尺寸应用标识。
- AI 回答由纯文本改为安全 Markdown 渲染，不再显示 `###`、`**` 和 fenced code 源码。
- 支持标题、强调、安全链接、引用、列表、表格、行内代码和代码块；流式未闭合代码块也可渐进显示。
- 原始 HTML、`javascript:` 和 `data:` 链接不会被执行。

## 0.2.1 MVP — 2026-08-27

### Fixed

- 新增由本地网关托管的 `/preview/` 管理页交互预览，修复直接访问网关只能得到 404 的问题。
- `npm run preview` 独立使用 8788 端口，不占用扩展网关的 8787 端口。
- HTTP 预览使用独立演示数据，不依赖 `chrome.runtime`，也不会保存或发送 Provider 表单内容。

## 0.2.0 MVP — 2026-08-27

### Added

- Provider 管理页：新增、编辑、删除、连接测试、默认 Provider 和模型。
- MiniMax CN、MiniMax Global、Custom OpenAI-compatible Registry。
- Versioned IndexedDB：settings/providers/sessions/branches/knowledge/weaknesses/reviews。
- 旧 `sideaskHistory` 自动迁移。
- Learning Branch 状态、Knowledge Item consolidation 和 Weakness detection。
- 概览、历史支线、知识库和薄弱点页面。
- Canonical brand assets、正式图标、Slogan 和 design tokens。
- Provider、stream、error、storage model 回归测试。

### Security

- 敏感节点排除和 URL query/hash 清理。
- Gateway Origin / JSON Content-Type 防护。
- Provider 错误归一化、日志降敏和 Key 隔离。

## 0.1.2

- MiniMax CN Token Plan 支持、SSE 增量解析和 Anchor/history MVP。
