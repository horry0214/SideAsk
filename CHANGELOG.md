# Changelog

## 0.7.0 Browser First + SideAsk Anywhere — 2026-08-29

### Added

- Added a standalone Windows WebView2 overlay for selections in VS Code, PDFs, native apps, terminals, and other desktop surfaces.
- Added the `Alt+Shift+A` global shortcut, cross-application selection capture, pointer-adjacent positioning, tray controls, pinning, click-away hiding, and return-to-app behavior.
- Added an opt-in browser-style selection cue: mouse-drag or double-click text to show **✦ Explain**, then click to open SideAsk. The selection is not sent before that click.
- Refined the selection cue into an animated brand pill, refreshed the overlay surfaces and spacing, and replaced fragile WebView-delayed `DragMove()` calls with native Windows title-bar dragging.
- Rebuilt the selection cue as one unclipped gradient capsule and added compact/expanded window modes so the idle overlay stays light and grows smoothly only when a conversation or settings needs room.
- Aligned the desktop overlay with the browser extension's proven visual language: one-piece dark Explain cue, clean white shell, quieter context and composer divisions, a roomier desktop conversation, and state-aware motion that does not flicker during streaming.
- Removed the visible Windows accent frame while preserving native edge resizing, resize cursors, snap behavior, and the app's own rounded visual border.
- Added WebView-aware invisible resize zones on all four edges and corners, and changed the default desktop proportions from a squat near-square to a narrower, taller companion window.
- Replaced automatic clipboard probing after arbitrary mouse drags with bounded Windows UI Automation selection checks; unsupported or empty selections now do nothing and explicit shortcuts retain the clipboard fallback.
- Made native drag/resize startup asynchronous and temporarily disables costly WebView shadows, filters, and motion while the operating-system resize loop is active.
- Replaced platform-dependent header and send glyphs with a consistent custom SVG icon set, with refined language, pin, minimize, close, hover, pressed, and active states.
- Added an explicit Gateway API version and capability manifest, and made Desktop verify the shared Provider endpoint before reusing an existing loopback Gateway. Incompatible legacy instances now produce an actionable upgrade message instead of `Not found`.
- The desktop selection Explain cue now dismisses when the user clicks elsewhere, switches foreground apps, presses Escape, or closes the popup without asking.
- Kept explicit launches visible long enough to receive focus, restored a taskbar entry while the window is open, and made tray/second-instance activation reliably reveal an already running SideAsk.
- Added streaming safe Markdown, bilingual quick prompts and follow-ups, and the full 25-profile Provider settings inside the overlay.
- Added one local encrypted Provider Vault shared by browser and desktop.
- Added a native WPF build that reuses the system WebView2 Runtime and bundles a silent Node.js Gateway; the unpacked preview is about 90 MiB instead of the 366 MiB Electron prototype.

### Privacy

- Desktop sends only deliberate selected text and the active side conversation. The optional selection cue reads a confirmed Windows UI Automation text selection locally and sends nothing until **✦ Explain** is clicked. Ordinary drags are never probed with automatic `Ctrl+C`; unsupported apps fall back only when the user invokes the shortcut. SideAsk does not inspect nearby content in another native app, capture the screen, or keep a global clipboard history.

### Direction

- The desktop overlay becomes the non-browser SideAsk experience. The redundant v0.6 VS Code Companion source, build, tests, VSIX artifact, and installation guides were removed.

## 0.6.0 SideAsk Anywhere — 2026-08-28

### Added

- Added a focused VS Code side-question panel for editor selections without modifying files or interrupting the active coding-agent conversation.
- Added `Ask about Clipboard` for copied Codex Chat, terminal, and other isolated extension-view content.
- Added streaming safe Markdown, follow-ups, four quick prompts, source reveal, and an optional nearby-lines context toggle.
- Added bilingual commands and interface copy, Gateway health state, and the full 25-profile Provider catalog.
- Added a standalone VSIX build, tests, and bilingual installation guides.
- Added an encrypted Local Provider Vault in the Gateway so the browser extension and VS Code Companion share saved Providers and the default model without an account or cloud sync.
- Added one-time, non-destructive migration from legacy browser IndexedDB and VS Code Secret Storage Provider records.

### Changed

- Provider setup, testing, switching, editing, and deletion now operate on the same on-device Vault from either client.
- Browser chat and VS Code chat resolve the shared default inside the Gateway; saved API keys are never returned to either client.

### Privacy

- Editor input is bounded to the deliberate selection and a configurable number of nearby lines.
- Another extension's Webview is never inspected; clipboard input requires an explicit copy and command.

## 0.5.0 Provider Catalog — 2026-08-28

### Added

- Added a shared declarative catalog with 25 first-party, router, inference, local, and custom Provider profiles.
- Added native Anthropic Messages API streaming and model discovery.
- Added official OpenAI-compatible presets for OpenAI, Gemini, xAI, OpenRouter, Vercel AI Gateway, Perplexity, DeepSeek, Qwen, Z.AI, Groq, Fireworks AI, Mistral, Together AI, Cerebras, Hugging Face, SiliconFlow, and NVIDIA NIM.
- Added keyless local Ollama and LM Studio profiles.
- Added draft connection testing and live model discovery in the Provider dialog.

### Compatibility

- Existing MiniMax and custom OpenAI-compatible records continue to work; missing historical Base URLs resolve to catalog defaults.
- MiniMax Token Plan environment variables and request defaults remain compatible.

## 0.4.0 Simple Core — 2026-08-28

### Changed

- Reduced the dashboard to three destinations: Recent, Favorites, and Settings.
- Replaced “Got it” / “Still fuzzy” knowledge-state controls with one optional Favorite action.
- Moved Provider management into Settings and removed knowledge, weakness, review, and overview surfaces from the main interface.
- Reframed local memory as automatic recent history plus intentional favorites.
- Rewrote the bilingual README, onboarding copy, store listing, privacy copy, and store screenshots around the simpler workflow.

### Compatibility

- Existing v0.3 branch, knowledge, and weakness data is preserved. The old derived stores remain readable but are no longer exposed as user workflows.
- Legacy dashboard URLs are redirected to the closest Simple Core destination.

## 0.3.1 Store RC — 2026-08-28

### Added

- Bilingual first-run guide that verifies the Local Gateway and Provider, captures an explicit data disclosure acknowledgment, and opens the real selection experience on a bundled practice page.
- Optional HTTP/HTTPS website access with in-product grant and revoke controls; toolbar-only `activeTab` access remains available after consent.
- Localized manifest metadata for English and Simplified Chinese store listings.
- Chrome Web Store and Microsoft Edge Add-ons upload ZIPs, five localized screenshots per language, required promotional tiles, Edge logo, listing copy, privacy declarations, reviewer notes, and submission checklists.
- Stable `sideask-gateway.zip` companion package for the setup guide and store reviewers.

### Security

- Broad website access is no longer required at installation and is activated only after the user reads the data disclosure and grants the optional permission.
- Dynamic content-script registration is synchronized with the user's website-access choice.

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
