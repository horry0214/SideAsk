# 安全策略

## 支持版本

当前只维护最新的 SideAsk MVP 版本。安全修复不会承诺回移到早期 zip。

## 报告方式

请使用 GitHub Private Security Advisory 报告漏洞。不要在公开 Issue 中粘贴 API Key、Provider 响应、网页内容、浏览历史或可识别用户的数据。

报告应包含：受影响版本、最小复现、影响范围和建议修复；所有凭证必须替换为假值。

## 当前安全边界

- Gateway 仅绑定 `127.0.0.1`。
- POST 只接受 JSON，并拒绝普通 `http(s)` 网页 Origin。
- Provider Key 使用独立随机本机密钥加密保存在 Gateway 本机 Vault，或留在用户自己的 `.env` 回退配置中。
- 浏览器与桌面端配置客户端只能取得脱敏 Provider 元数据。
- Content Script 不接收 Provider Key。
- 日志只包含 provider id、normalized error code 和 HTTP status。
- 上游错误正文不会原样返回 UI。

不要把 SideAsk Gateway 暴露到局域网或公网。只从官方 Provider 控制台创建最小权限 Key，并在怀疑泄露时立即轮换。
