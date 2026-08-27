# 参与 SideAsk

感谢你帮助 SideAsk 实现“问题走支线，思路留主线”。当前项目优先保证可运行行为，不以框架或抽象数量衡量贡献。

## 开发准备

要求 Node.js 20+。仓库当前零依赖：

```bash
npm run check
```

在 Chrome 或 Edge 的扩展管理页加载 `extension/`。修改后重新加载扩展并刷新测试网页。

## 贡献原则

1. 先说明用户问题，再修改代码。
2. 保留 selection、streaming、Anchor、MiniMax Token Plan 与旧数据迁移。
3. Provider 差异必须留在 Provider 层，Core 不增加供应商条件链。
4. 不提交 API Key、真实对话、浏览历史或带 query/hash 的私有 URL。
5. 新数据字段应包含明确 migration 策略。
6. UI 保持 quiet、minimal、keyboard-accessible。
7. 修改相关行为时同步测试和文档。

## 提交前检查

- `npm run check` 通过。
- Chrome 与 Edge 至少各完成一次手动 smoke test。
- 没有 `.env`、Key、Token、日志或个人数据进入 diff。
- README、CHANGELOG 或相关设计文档已更新。
- 新错误使用 normalized error code，不回显上游原文。

建议提交信息：`type(scope): concise summary`，例如 `feat(storage): add branch migration`。
