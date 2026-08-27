# SideAsk v0.2.0 MVP Acceptance

评估日期：2026-08-27。

## Accepted

- Manifest V3 extension、正式品牌和扩展图标。
- Generic Web / ChatGPT 通用 selection、context、floating UI 和多轮 streaming 链路。
- Anchor：Live Range → selector/text → text lookup → scrollY。
- MiniMax CN / Global 与 Custom OpenAI-compatible Provider Registry。
- Provider Add/Edit/Delete/Test/Default/Model 管理闭环。
- Key 隔离：Content Script 不可见；扩展私有 IndexedDB → Service Worker → loopback gateway。
- LearningSession / LearningBranch / KnowledgeItem / WeaknessItem 本地模型。
- 旧扁平历史非破坏迁移。
- 我懂了 / 还模糊、知识库、薄弱点与重复问题证据。
- Gateway Origin/JSON 防护、敏感节点排除、URL 清理和 normalized errors。
- README、Privacy、Security、Contributing、Code of Conduct、Changelog 和 Release Checklist。

## Automated evidence

- `npm run check`：通过。
- 15 个 Node regression tests：通过。
- Manifest 路径、Options DOM 引用、README link、credential scan：通过。
- Gateway smoke：health 200、web origin 403、non-JSON 415、invalid provider config 400。

## Manual release checks still required

- 在用户 Chrome 和 Edge 中各加载一次 unpacked extension。
- 使用用户自己的 Provider Key 验证真实 streaming；这可能产生外部 API 费用，因此自动验收没有代替用户发起调用。
- 验证 ChatGPT 与一个 Generic Web 页面上的选择、状态沉淀和 Anchor。
- 项目方选择 Apache-2.0 或 MIT 并加入标准 `LICENSE`，之后才能宣称完成开源发布。

## MVP boundaries

PDF 专用 adapter、ChatGPT 专用 adapter、复习调度、跨设备同步、云账户、复杂 RAG 和知识图谱不属于 v0.2.0 MVP。
