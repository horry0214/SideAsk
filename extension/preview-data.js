const now = Date.now();

const branches = [
  {
    id: "preview-branch-1",
    selectedText: "phi 指令",
    sourceTitle: "LLVM 中的 SSA",
    sourceUrl: "https://example.com/llvm-ssa",
    sourceContext: "phi 指令会根据控制流实际经过的前驱基本块选择对应值。",
    status: "understood",
    favorite: true,
    updatedAt: now - 12 * 60_000,
    messages: [
      { role: "user", content: "phi 指令在这里是什么意思？" },
      { role: "assistant", content: "它像一个由控制流决定的选择器：程序从哪个前驱块进入，就选择那个分支提供的值。" },
    ],
  },
  {
    id: "preview-branch-2",
    selectedText: "活跃变量分析",
    sourceTitle: "编译器数据流分析笔记",
    sourceUrl: "https://example.com/live-range",
    sourceContext: "变量在某点之后仍可能被读取，则在该点是活跃的。",
    status: "unclear",
    favorite: false,
    updatedAt: now - 25 * 60 * 60_000,
    messages: [
      { role: "user", content: "live range 和 lifetime 有什么区别？" },
      { role: "assistant", content: "live range 是数据流意义上的可能使用区间；lifetime 更偏向对象从创建到销毁的存在时间。" },
    ],
  },
  {
    id: "preview-branch-3",
    selectedText: "向量组（Vector Chaining）",
    sourceTitle: "计算机体系结构",
    sourceUrl: "https://example.com/vector-chaining",
    sourceContext: "前一条向量指令的结果可以直接转发给后一条向量指令。",
    status: "active",
    favorite: true,
    updatedAt: now - 3 * 24 * 60 * 60_000,
    messages: [
      { role: "user", content: "向量链为什么能减少等待？" },
      { role: "assistant", content: "后一条指令不必等待整个向量完成，可以在首批元素产生后立即开始流水处理。" },
    ],
  },
];

const knowledge = [
  {
    id: "preview-knowledge-1",
    concept: "phi 指令",
    status: "understood",
    explanation: "在 SSA 中，根据实际进入当前基本块的前驱路径选择对应变量版本。",
    askCount: 2,
    lastSeenAt: branches[0].updatedAt,
  },
  {
    id: "preview-knowledge-2",
    concept: "活跃变量分析",
    status: "weak",
    explanation: "判断变量当前值在未来控制流路径上是否仍可能被使用。",
    askCount: 3,
    lastSeenAt: branches[1].updatedAt,
  },
  {
    id: "preview-knowledge-3",
    concept: "Vector Chaining",
    status: "learning",
    explanation: "允许存在数据依赖的向量流水线按元素衔接执行。",
    askCount: 1,
    lastSeenAt: branches[2].updatedAt,
  },
];

const weaknesses = [
  {
    id: "preview-weakness-1",
    reason: "user_marked_unclear",
    weight: 3,
    lastDetectedAt: branches[1].updatedAt,
    knowledge: knowledge[1],
  },
];

let providers = [
  {
    id: "preview-provider-1",
    type: "minimax-cn",
    displayName: "MiniMax CN",
    model: "MiniMax-M2.7",
    baseUrl: "",
    apiKeyConfigured: true,
  },
];
let defaultProviderId = providers[0].id;

function includes(value, query) {
  return String(value || "").toLocaleLowerCase().includes(query);
}

function filterBranches(query = {}) {
  const search = String(query.search || "").trim().toLocaleLowerCase();
  return branches
    .filter(item => !query.status || item.status === query.status)
    .filter(item => typeof query.favorite !== "boolean" || Boolean(item.favorite) === query.favorite)
    .filter(item => !search || [item.selectedText, item.sourceTitle, item.sourceContext].some(value => includes(value, search)))
    .slice(0, Number(query.limit) || 500);
}

function filterKnowledge(query = {}) {
  const search = String(query.search || "").trim().toLocaleLowerCase();
  return knowledge
    .filter(item => !query.status || item.status === query.status)
    .filter(item => !search || [item.concept, item.explanation].some(value => includes(value, search)))
    .slice(0, Number(query.limit) || 500);
}

function saveProvider(provider) {
  const existing = providers.find(item => item.id === provider.id);
  const record = {
    id: existing?.id || `preview-provider-${Date.now()}`,
    type: provider.type,
    displayName: provider.displayName,
    model: provider.model,
    baseUrl: provider.baseUrl || "",
    apiKeyConfigured: Boolean(provider.apiKey || existing?.apiKeyConfigured),
  };
  providers = existing
    ? providers.map(item => item.id === record.id ? record : item)
    : [...providers, record];
  if (!defaultProviderId) defaultProviderId = record.id;
  return record;
}

export function createPreviewBridge() {
  return {
    async send(type, payload = {}) {
      switch (type) {
        case "sideask-gateway-health": {
          const response = await fetch("/health", { cache: "no-store" });
          if (!response.ok) throw new Error("预览 Gateway 未连接。");
          return response.json();
        }
        case "sideask-stats":
          return {
            branches: branches.length,
            understood: branches.filter(item => item.status === "understood").length,
            knowledge: knowledge.length,
            weaknesses: weaknesses.length,
            favorites: branches.filter(item => item.favorite).length,
          };
        case "sideask-branches-list":
          return filterBranches(payload.query);
        case "sideask-branch-favorite": {
          const branch = branches.find(item => item.id === payload.branchId);
          if (!branch) throw new Error("Branch 不存在。");
          branch.favorite = Boolean(payload.favorite);
          branch.updatedAt = Date.now();
          return structuredClone(branch);
        }
        case "sideask-knowledge-list":
          return filterKnowledge(payload.query);
        case "sideask-weaknesses-list":
          return weaknesses.slice(0, Number(payload.query?.limit) || 500);
        case "sideask-provider-state":
          return { providers: structuredClone(providers), defaultProviderId };
        case "sideask-provider-save":
          return saveProvider(payload.provider || {});
        case "sideask-provider-delete":
          providers = providers.filter(item => item.id !== payload.providerId);
          if (defaultProviderId === payload.providerId) defaultProviderId = providers[0]?.id || null;
          return true;
        case "sideask-provider-default":
          defaultProviderId = payload.providerId;
          return true;
        case "sideask-provider-test":
          return { ok: true, modelAvailable: true };
        default:
          throw new Error(`预览模式暂不支持：${type}`);
      }
    },
  };
}
