# Provider Architecture

## 目标

Provider 层把供应商差异限制在注册项和 adapter 内。主业务只处理 normalized request、delta text 和 normalized error。

```text
Provider Registry
├── Auth/config validation
├── Model/config defaults
├── Capability declaration
├── Request normalization
├── Stream normalization
└── Error normalization
```

## 当前接口

```ts
interface Provider {
  id: string
  displayName: string
  apiMode: "openai-compatible" | "anthropic" | "gemini" | "ollama" | "custom"
  capabilities: {
    streaming: boolean
    reasoning?: boolean
    vision?: boolean
    tools?: boolean
    modelDiscovery?: boolean
  }
  validateConfig(config): ValidationResult
  chatStream(request, config, callbacks, fetchImpl?): Promise<void>
}
```

`callbacks.onReady()` 只在上游确认可读后触发，因此 gateway 可以在写入 HTTP 200 之前返回正确的 normalized error。

连接测试使用 OpenAI-compatible `GET /v1/models`，不会为了测试产生聊天请求。MiniMax CN 与 Global 均提供该接口：[CN 文档](https://platform.minimaxi.com/docs/api-reference/models/openai/list-models)、[Global 文档](https://platform.minimax.io/docs/api-reference/models/openai/list-models)。

## 本轮注册项

- `minimax-cn`：默认 `https://api.minimaxi.com/v1`，兼容 Token Plan Key。
- `minimax-global`：默认 `https://api.minimax.io/v1`。
- `openai-compatible`：用户提供 Display Name、Base URL、API Key、Model。

MiniMax 继续兼容原有 `MINIMAX_*` 环境变量。管理页已支持 Add/Edit/Delete/Test/Default/Model；配置保存在扩展私有 IndexedDB，由 Service Worker 在请求时发送给 loopback gateway。若浏览器没有默认 Provider，Gateway 回退到 `.env`。

## Normalized request

```ts
interface NormalizedChatRequest {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  parameters?: {
    temperature?: number
    topP?: number
    maxCompletionTokens?: number
  }
}
```

Context Builder 在 request 进入 Provider 前完成。Provider 不读取 DOM、历史存储或 Anchor。

## Stream normalization

OpenAI-compatible parser 接受任意 chunk 边界，只向 UI 转发 `choices[0].delta.content`（以及兼容的文本 content part），忽略 reasoning content 和未知 event。`[DONE]` 终止事件不进入 UI。

## Error normalization

公开错误码：

```text
invalid_api_key
model_not_found
rate_limited
quota_exhausted
provider_unreachable
network_failure
invalid_provider_config
invalid_provider_response
request_aborted
```

UI 只接收短、可执行的中文提示。日志记录 provider id、HTTP status 与 error code，但不记录 API Key、Authorization header、完整请求或未经清理的上游正文。

## 下一步

1. 根据真实用户需求增加 Anthropic、Gemini、Ollama；不让 Core 出现供应商条件分支。
2. 为支持的 Provider 增加可选模型发现和更精确的 capability metadata。
3. 评估 OS credential store / native host，进一步强化本地 Key at-rest 保护。
