const profiles = [
  ["minimax-cn", "MiniMax CN", "https://api.minimaxi.com/v1", "MiniMax-M2.7"],
  ["minimax-global", "MiniMax Global", "https://api.minimax.io/v1", "MiniMax-M2.7"],
  ["openai", "OpenAI", "https://api.openai.com/v1", "gpt-5.6-luna"],
  ["anthropic", "Anthropic", "https://api.anthropic.com/v1", "claude-sonnet-5"],
  ["gemini", "Google Gemini", "https://generativelanguage.googleapis.com/v1beta/openai", "gemini-3.6-flash"],
  ["xai", "xAI", "https://api.x.ai/v1", "grok-4.5"],
  ["openrouter", "OpenRouter", "https://openrouter.ai/api/v1", "~openai/gpt-latest"],
  ["vercel-ai-gateway", "Vercel AI Gateway", "https://ai-gateway.vercel.sh/v1", "anthropic/claude-sonnet-4.6"],
  ["perplexity", "Perplexity", "https://api.perplexity.ai/v1", "sonar"],
  ["huggingface", "Hugging Face", "https://router.huggingface.co/v1", "openai/gpt-oss-120b:fastest"],
  ["deepseek", "DeepSeek", "https://api.deepseek.com", "deepseek-v4-flash"],
  ["qwen-cn", "Alibaba Qwen · China", "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus"],
  ["qwen-global", "Alibaba Qwen · Global", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", "qwen-plus"],
  ["zai-global", "Z.AI", "https://api.z.ai/api/paas/v4", "glm-5.1"],
  ["zai-cn", "智谱 BigModel", "https://open.bigmodel.cn/api/paas/v4", "glm-5.1"],
  ["siliconflow", "SiliconFlow", "https://api.siliconflow.com/v1", "zai-org/GLM-5.1"],
  ["groq", "Groq", "https://api.groq.com/openai/v1", "openai/gpt-oss-120b"],
  ["fireworks", "Fireworks AI", "https://api.fireworks.ai/inference/v1", "accounts/fireworks/models/llama-v3p1-8b-instruct"],
  ["mistral", "Mistral AI", "https://api.mistral.ai/v1", "mistral-small-latest"],
  ["together", "Together AI", "https://api.together.ai/v1", "openai/gpt-oss-20b"],
  ["cerebras", "Cerebras", "https://api.cerebras.ai/v1", "zai-glm-4.7"],
  ["nvidia-nim", "NVIDIA NIM", "https://integrate.api.nvidia.com/v1", "openai/gpt-oss-20b"],
  ["ollama", "Ollama", "http://127.0.0.1:11434/v1", "", false],
  ["lm-studio", "LM Studio", "http://127.0.0.1:1234/v1", "", false],
  ["openai-compatible", "Custom OpenAI-compatible", "", ""]
];

const PROVIDER_CATALOG = Object.freeze(profiles.map(([id, displayName, defaultBaseUrl, defaultModel, apiKeyRequired = true]) => Object.freeze({
  id,
  displayName,
  defaultBaseUrl,
  defaultModel,
  apiKeyRequired
})));

function getProviderProfile(id) {
  return PROVIDER_CATALOG.find(profile => profile.id === String(id || "").trim()) || null;
}

module.exports = { PROVIDER_CATALOG, getProviderProfile };
