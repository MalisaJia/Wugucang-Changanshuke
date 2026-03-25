export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  providerName: string;
  providerColor: string;
  description: string;
  contextWindow: string;
  pricing: string;
  capabilities?: string[];
}

export interface ProviderInfo {
  id: string;
  name: string;
  color: string;
  modelCount: number;
}

export const providers: ProviderInfo[] = [
  { id: "openai", name: "OpenAI", color: "#10A37F", modelCount: 10 },
  { id: "anthropic", name: "Anthropic", color: "#D4A574", modelCount: 3 },
  { id: "google", name: "Google", color: "#4285F4", modelCount: 1 },
];

export const models: ModelInfo[] = [
  // OpenAI
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    providerName: "OpenAI",
    providerColor: "#10A37F",
    description: "OpenAI flagship multimodal model with vision, audio, and text capabilities. Fast and cost-effective.",
    contextWindow: "128k",
    pricing: "$2.50 / 1M tokens",
    capabilities: ["chat", "code", "analysis", "vision"],
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    providerName: "OpenAI",
    providerColor: "#10A37F",
    description: "OpenAI lightweight and efficient model. Great value for high-volume tasks with excellent performance.",
    contextWindow: "128k",
    pricing: "$0.15 / 1M tokens",
    capabilities: ["chat", "code", "analysis"],
  },
  // GPT-4.1 Series (new generation)
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    providerName: "OpenAI",
    providerColor: "#10A37F",
    description: "OpenAI's latest GPT-4.1 model with improved coding, instruction following, and long-context performance.",
    contextWindow: "1M",
    pricing: "$2.00 / 1M tokens",
    capabilities: ["chat", "code", "analysis", "long-context"],
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    providerName: "OpenAI",
    providerColor: "#10A37F",
    description: "Compact version of GPT-4.1. Excellent balance of capability and cost for most tasks.",
    contextWindow: "1M",
    pricing: "$0.40 / 1M tokens",
    capabilities: ["chat", "code", "analysis"],
  },
  {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    providerName: "OpenAI",
    providerColor: "#10A37F",
    description: "Smallest GPT-4.1 variant. Ultra-fast and cost-effective for simple tasks.",
    contextWindow: "1M",
    pricing: "$0.10 / 1M tokens",
    capabilities: ["chat", "code"],
  },
  // GPT-3.5 Series
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "openai",
    providerName: "OpenAI",
    providerColor: "#10A37F",
    description: "OpenAI classic model. Fast and cost-effective for simple tasks like summarization and classification.",
    contextWindow: "16k",
    pricing: "$0.50 / 1M tokens",
    capabilities: ["chat", "code"],
  },
  {
    id: "gpt-3.5-turbo-0125",
    name: "GPT-3.5 Turbo 0125",
    provider: "openai",
    providerName: "OpenAI",
    providerColor: "#10A37F",
    description: "Latest GPT-3.5 Turbo snapshot from Jan 2025. Improved instruction following and JSON mode.",
    contextWindow: "16k",
    pricing: "$0.50 / 1M tokens",
    capabilities: ["chat", "code"],
  },
  {
    id: "gpt-3.5-turbo-1106",
    name: "GPT-3.5 Turbo 1106",
    provider: "openai",
    providerName: "OpenAI",
    providerColor: "#10A37F",
    description: "GPT-3.5 Turbo snapshot from Nov 2023. Supports parallel function calling and JSON mode.",
    contextWindow: "16k",
    pricing: "$0.50 / 1M tokens",
    capabilities: ["chat", "code"],
  },
  {
    id: "gpt-3.5-turbo-16k",
    name: "GPT-3.5 Turbo 16K",
    provider: "openai",
    providerName: "OpenAI",
    providerColor: "#10A37F",
    description: "Extended context version of GPT-3.5 Turbo with 16K token window for longer conversations.",
    contextWindow: "16k",
    pricing: "$0.50 / 1M tokens",
    capabilities: ["chat", "code"],
  },
  {
    id: "gpt-3.5-turbo-16k-0613",
    name: "GPT-3.5 Turbo 16K 0613",
    provider: "openai",
    providerName: "OpenAI",
    providerColor: "#10A37F",
    description: "Stable GPT-3.5 Turbo 16K snapshot from June 2023. Reliable for production use.",
    contextWindow: "16k",
    pricing: "$0.50 / 1M tokens",
    capabilities: ["chat", "code"],
  },
  // Anthropic
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4",
    provider: "anthropic",
    providerName: "Anthropic",
    providerColor: "#D4A574",
    description: "Anthropic's most powerful reasoning model. Excels at complex analysis, coding, and research tasks.",
    contextWindow: "200k",
    pricing: "$15.00 / 1M tokens",
    capabilities: ["chat", "code", "analysis", "reasoning"],
  },
  {
    id: "claude-opus-4-6-thinking",
    name: "Claude Opus 4 Thinking",
    provider: "anthropic",
    providerName: "Anthropic",
    providerColor: "#D4A574",
    description: "Claude Opus 4 with extended thinking. Shows step-by-step reasoning for complex problem solving.",
    contextWindow: "200k",
    pricing: "$15.00 / 1M tokens",
    capabilities: ["chat", "code", "analysis", "reasoning", "thinking"],
  },
  {
    id: "claude-sonnet-4-6-thinking",
    name: "Claude Sonnet 4 Thinking",
    provider: "anthropic",
    providerName: "Anthropic",
    providerColor: "#D4A574",
    description: "Anthropic's balanced model with extended thinking. Great combination of speed, cost, and intelligence.",
    contextWindow: "200k",
    pricing: "$3.00 / 1M tokens",
    capabilities: ["chat", "code", "analysis", "thinking"],
  },
  // Google
  {
    id: "gemini-2.5-flash-thinking",
    name: "Gemini 2.5 Flash Thinking",
    provider: "google",
    providerName: "Google",
    providerColor: "#4285F4",
    description: "Google's fast reasoning model. Combines speed with thoughtful analysis for efficient problem solving.",
    contextWindow: "1M",
    pricing: "$0.15 / 1M tokens",
    capabilities: ["chat", "code", "analysis", "thinking"],
  },
];
