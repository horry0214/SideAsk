# SideAsk MVP Release Checklist

## Automated

- [ ] `npm run check`
- [ ] Manifest JSON 可解析，所有 icon/options 路径存在
- [ ] 仓库不存在 `.env`、真实 Key、Token 或日志
- [ ] README 本地链接完整
- [ ] Gateway health / invalid config / origin / content-type smoke tests

## Chrome

- [ ] 加载 `extension/` 无错误
- [ ] Generic Web 划词出现 `✦ 解释`
- [ ] ChatGPT 划词与流式回答正常
- [ ] 最近记录自动保存，收藏可添加与取消
- [ ] Anchor 返回正常
- [ ] Provider Add/Edit/Test/Default/Delete 正常

## Edge

- [ ] 重复 Chrome smoke test
- [ ] Edge 原生 mini menu 与 SideAsk 共存

## Windows Desktop

- [ ] Windows x64 ZIP 完整解压后可启动，托盘与全局快捷键可用
- [ ] 快捷键取词、流式 Markdown、追问与回到原应用正常
- [ ] 开启选区按钮后，拖选/双击显示 **✦ 解释**，点击前不请求 Provider
- [ ] 与浏览器共享 Provider 列表与默认 Provider

## Privacy and security

- [ ] password/input/textarea/contenteditable 不显示 SideAsk 入口
- [ ] URL query/hash 不进入 Branch 或 Provider prompt
- [ ] UI / console / gateway log 不出现 Key
- [ ] 普通网页 Origin 的 Gateway POST 返回 403
- [ ] Provider API 只返回脱敏元数据，Vault 文件不存在明文 Key
- [ ] 浏览器旧 Provider 记录可非破坏迁移

## Publication

- [ ] 项目方选择 MIT 或 Apache-2.0，并加入 `LICENSE`
- [ ] GitHub Private Security Advisory 已启用
- [ ] README 截图与当前实现一致
- [ ] 打包版本与 manifest/package/changelog 一致
- [ ] Chrome ZIP、Edge ZIP、Gateway ZIP 与 Windows Desktop ZIP 来自同一提交
