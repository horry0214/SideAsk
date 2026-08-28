# SideAsk Short-term Roadmap

每个阶段结束时必须满足：扩展可加载、基本查询可用、本地数据可读、测试通过、README 同步。

## Phase 0 — Stabilize & Brand

状态：**已完成并在 v0.5.0 扩展**

目标：为现有 MVP 建立可维护基线，不改变核心使用路径。

- 完成 Current Repository Assessment 和核心设计文档。
- 落入 canonical Logo、extension icons、正式名称、Slogan 与 design tokens。
- 建立 Provider Registry skeleton、OpenAI-compatible stream parser 与 error normalizer。
- 保持 MiniMax CN Token Plan 环境变量和请求行为兼容。
- 排除敏感 selection/context，清理 URL query/hash。
- 增加 Node 内置测试与 JS syntax check。

验收：Chrome/Edge 可加载；Generic Web/ChatGPT 划词入口出现；本地 server health 正常；mock stream parser tests 通过。

## Phase 1 — Provider Experience

状态：**已完成（v0.2.0 MVP）**

目标：用户不改源码即可选择和验证模型服务。

- Provider Settings：Add/Edit/Delete/Test/Default/Model。
- 声明式 Provider Catalog：25 个预设，覆盖主流官方服务、路由、高速推理、本地模型与 Custom OpenAI-compatible。
- Anthropic 原生 Messages/SSE adapter；其余官方兼容服务复用 OpenAI-compatible adapter。
- Provider 草稿连接测试、实时模型发现与 Catalog 模型建议。
- Provider config 本地存储、Key 脱敏显示、连接测试与错误指引。
- 将 Context Builder 与 Provider request contract 稳定下来。
- 增加 mock gateway integration tests；验证 Chrome + Edge。

验收：25 个 Provider 类型可在 UI 配置和切换；本地模型允许无 Key；MiniMax Token Plan 回归通过；Anthropic 与 OpenAI-compatible stream tests 通过；无 Key 出现在仓库、日志或 UI error。

## Phase 2 — Learning Branch Foundation

状态：**已完成 MVP 基础（v0.2.0）**

目标：从扁平历史迁移到可沉淀知识状态的 Learning Branch。

- IndexedDB versioned schema：sessions/branches/messages/knowledge/weaknesses。
- 旧 `sideaskHistory` 非破坏迁移。
- `parentId`、understood/unclear/review 状态与“还模糊”。
- 最小 Knowledge Item consolidation、重复提问计数与 Weakness detection。
- 知识库/错题本最小列表与关键词搜索。
- Anchor serialization 与 storage migration tests。

验收：旧历史仍可读取；Branch schema 支持 parent-child；“我懂了/还模糊”能更新知识状态；无复杂图谱、RAG 或云依赖。

## Phase 3 — Bilingual Experience & Open-source Showcase

状态：**已完成（v0.3.0 MVP）**

目标：让中英文用户都能直接理解、配置并使用 SideAsk。

- 管理页与网页悬浮窗支持 English / 简体中文切换。
- 语言偏好持久保存，并在扩展页面之间同步。
- 快捷提问和 Gateway system prompt 跟随所选语言。
- README 使用双语真实界面截图和 23 秒演示 GIF。
- 增加 locale normalization、translation fallback 和 bilingual prompt tests。

验收：切换后刷新仍保持；管理页和悬浮窗语言一致；英文快捷提问得到英文 system prompt；中英文 README 素材均可加载。

## Phase 4 — Simple Core

状态：**已完成候选版（v0.4.0）**

目标：让 SideAsk 回到最简单的价值——划词提问，不离开当前内容。

- 主界面收敛为“最近、收藏、设置”。
- 最近提问自动保存，不要求用户分类或维护状态。
- “我懂了 / 还模糊”收敛为一个可选的“收藏”动作。
- Provider 管理并入设置。
- 旧知识与薄弱点数据非破坏保留，但不再占据产品主流程。

验收：划词、解释、追问、回到原文、最近历史、收藏与设置均可独立完成；升级不会丢失旧记录。

后续候选项只接受“小而直接”的能力：快捷键、复制/导出、回答深度、来源 Anchor 强化和可选备份。账户、云同步、知识图谱、复习系统与完整对话导入继续延后。
