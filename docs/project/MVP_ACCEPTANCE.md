# SideAsk v0.5.0 Provider Catalog Acceptance

评估日期：2026-08-28。

## Accepted

- Manifest V3 extension、正式品牌和扩展图标。
- Generic Web / ChatGPT 通用 selection、context、floating UI 和多轮 streaming 链路。
- Anchor：Live Range → selector/text → text lookup → scrollY。
- 25 个声明式 Provider Profile；Anthropic 原生 Messages adapter 与共享 OpenAI-compatible adapter。
- Provider Add/Edit/Delete/Test/Default/Model 管理闭环，以及未保存草稿的实时模型发现。
- Key 隔离：Content Script 不可见；扩展私有 IndexedDB → Service Worker → loopback gateway。
- 旧扁平历史非破坏迁移。
- 最近提问自动保存；收藏可以添加与取消。
- 管理页只有最近、收藏、设置三个入口，Provider 已并入设置。
- v0.3 Knowledge / Weakness 数据非破坏保留，但不再暴露为用户工作流。
- Gateway Origin/JSON 防护、敏感节点排除、URL 清理和 normalized errors。
- README、Privacy、Security、Contributing、Code of Conduct、Changelog 和 Release Checklist。

## Automated evidence

- `npm run check`：通过。
- 30 个 Node regression tests：通过。
- Manifest 路径、Options DOM 引用、README link、credential scan：通过。
- Gateway smoke：health 200、web origin 403、non-JSON 415、invalid provider config 400。

## Manual release checks still required

- 在用户 Chrome 和 Edge 中各加载一次 unpacked extension。
- 使用用户自己的 Provider Key 验证真实 streaming；这可能产生外部 API 费用，因此自动验收没有代替用户发起调用。
- 验证 ChatGPT 与一个 Generic Web 页面上的选择、自动历史、收藏和 Anchor。
- Chrome Web Store / Edge Add-ons 正式提交仍需使用各平台开发者账户完成。

## MVP boundaries

PDF 专用 adapter、ChatGPT 专用 adapter、复习调度、跨设备同步、云账户、完整对话导入、复杂 RAG 和知识图谱不属于 v0.5.0 Provider Catalog。
