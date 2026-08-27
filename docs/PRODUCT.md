# SideAsk Product

## 定位

**SideAsk 是 AI 支线提问层。**

> 问题走支线，思路留主线。

> Ask aside. Stay on track.

用户不必离开正在阅读的网页，就能围绕局部内容提问、追问、确认理解，再准确返回原文。长期产品不是聊天记录容器，而是能保留问题来源、理解状态与复习证据的个人知识系统。

## 核心循环

```text
阅读主线 → 遇到卡点 → 打开支线 → context-aware 提问
        → 理解 / 仍模糊 → 回到原文 → 沉淀与复习
```

## 产品原则

- **Quiet**：不与当前内容争夺注意力。
- **Context-preserving**：保存问题来自哪里，并能返回原处。
- **Minimum Sufficient Context**：只发送完成解释所需的最小上下文。
- **Local-first**：历史、知识状态与 Provider 配置默认留在本地。
- **Evidence before abstraction**：原问题、原回答和来源不可被生成摘要覆盖。
- **Progressive complexity**：每个阶段都保持扩展可加载、查询可用、数据可读。

## 当前 MVP 范围

- Chrome / Edge 网页划词。
- 轻量浮窗、快捷提问、多轮追问。
- Generic DOM Context Extractor。
- Anchor 恢复。
- MiniMax 流式问答与本地历史。

## 近期产品边界

近期加入：Provider Registry、Custom OpenAI-compatible、Learning Branch、Knowledge Item、还模糊、知识库与最小复习循环。

近期不加入：用户登录、云同步、付费、Multi-agent、复杂 RAG、Graph DB、复杂 ontology、移动端或桌面端。

## 隐私承诺

默认只处理用户主动选择的文本、必要的附近上下文、当前支线消息以及用于返回原文的 Anchor。默认不采集整页、全部聊天记录、浏览历史、密码字段、表单输入或编辑器草稿。发送给模型前应排除敏感节点，并移除 URL 的 query、hash 与凭证信息。

## 成功指标

- `Return to Anchor` 使用率。
- 支线结束后继续阅读的比例。
- 单次支线解决卡点所需时间与追问轮数。
- 用户标记“已理解 / 还模糊”的覆盖率。
- 同一概念重复出现时，回答能否利用已有知识状态而非从零开始。
