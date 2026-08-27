# Knowledge Model

## 原则

聊天是原始证据，不等于知识。SideAsk 先保存问题来自哪里、用户如何追问、AI 如何回答，再从这些证据派生可重新生成的 KnowledgeItem。

## LearningSession

```ts
interface LearningSession {
  id: string
  title?: string
  sourceUrl: string
  sourceTitle?: string
  createdAt: number
  updatedAt: number
}
```

## LearningBranch

```ts
interface LearningBranch {
  id: string
  sessionId: string
  parentId?: string
  selectedText: string
  sourceContext: string
  anchor: SourceAnchor
  messages: Message[]
  status: "active" | "understood" | "unclear" | "review"
  createdAt: number
  updatedAt: number
}
```

`parentId` 允许支线自然形成树。第一阶段 UI 可以只展示列表，但存储不能把相同概念的多次提问覆盖成一条记录。

## KnowledgeItem

```ts
interface KnowledgeItem {
  id: string
  concept: string
  explanation: string
  summary?: string
  aliases?: string[]
  sourceBranches: string[]
  sourceUrls?: string[]
  tags?: string[]
  status: "new" | "learning" | "understood" | "weak" | "mastered"
  confidence?: number
  firstSeenAt: number
  lastSeenAt: number
  askCount: number
  reviewCount: number
  createdAt: number
  updatedAt: number
}
```

`explanation/summary` 是 derived data；Branch messages 与 sourceContext 是 evidence。重新生成摘要不能覆盖证据。

## WeaknessItem

```ts
interface WeaknessItem {
  id: string
  knowledgeId: string
  reason:
    | "repeated_question"
    | "user_marked_unclear"
    | "forgotten"
    | "confused_concept"
    | "low_confidence"
  weight: number
  firstDetectedAt: number
  lastDetectedAt: number
  resolved: boolean
}
```

首轮规则保持简单：用户点击“还模糊”立即创建/更新 weakness；同概念多次出现增加 `askCount`，达到阈值后增加 `repeated_question` 权重。

## KnowledgeRelation

```ts
interface KnowledgeRelation {
  sourceId: string
  targetId: string
  type: "related" | "prerequisite" | "part_of" | "confused_with"
}
```

第一阶段只使用 IndexedDB relation store，不引入图数据库、embedding 或 ontology。

## 状态转换

```text
Branch active
├── 我懂了 → Branch understood → create/update KnowledgeItem understood
└── 还模糊 → Branch unclear → KnowledgeItem weak → upsert WeaknessItem

Review
├── 记得 → confidence up
├── 模糊 → confidence down + weakness weight up
└── 忘了 → status weak + next review candidate
```

所有自动判断都应保留 reason、timestamp 与 source branch，以便解释和修正。
