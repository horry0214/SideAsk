# SideAsk Product

## 定位

**SideAsk 是 AI 支线提问层。**

> 问题走支线，思路留主线。

> Ask aside. Stay on track.

用户不必离开正在阅读的网页，就能围绕局部内容提问、追问，再准确返回原文。SideAsk 不替代网页、聊天工具或知识库；它只处理当前主线旁边的小问题。

## 核心循环

```text
阅读主线 → 遇到卡点 → 打开支线 → context-aware 提问
        → 继续追问 → 回到原文
        └→ 值得以后再看时收藏
```

## 产品原则

- **Quiet**：不与当前内容争夺注意力。
- **Context-preserving**：保存问题来自哪里，并能返回原处。
- **Minimum Sufficient Context**：只发送完成解释所需的最小上下文。
- **Local-first**：最近记录、收藏与 Provider 配置默认留在本地。
- **Zero maintenance**：用户不需要分类、打标签、复习或维护知识状态。
- **Progressive enhancement**：新功能必须减少摩擦，且不能创造新的必经流程。

## 当前 MVP 范围

- Chrome / Edge 网页划词。
- 轻量浮窗、快捷提问、多轮追问。
- Generic DOM Context Extractor。
- Anchor 恢复。
- 25 个主流、路由、本地与自定义 Provider；支持 OpenAI-compatible 与 Anthropic 原生流式问答。
- 自动最近记录与主动收藏。
- “最近、收藏、设置”三入口。

## 近期产品边界

近期候选：快捷键、复制/导出、回答深度、来源 Anchor 强化与可选本地备份。

近期不加入：用户登录、云同步、知识图谱、复习系统、完整对话导入、复杂 RAG、Graph DB 或 ontology。

## 隐私承诺

默认只处理用户主动选择的文本、必要的附近上下文、当前支线消息以及用于返回原文的 Anchor。默认不采集整页、全部聊天记录、浏览历史、密码字段、表单输入或编辑器草稿。发送给模型前应排除敏感节点，并移除 URL 的 query、hash 与凭证信息。

## 成功指标

- `Return to Anchor` 使用率。
- 支线结束后继续阅读的比例。
- 单次支线解决卡点所需时间与追问轮数。
- 收藏使用率与取消收藏率。
- 新用户从安装到第一次成功划词提问所需时间。
