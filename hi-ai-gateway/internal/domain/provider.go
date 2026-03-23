package domain

// ProviderID constants for all supported providers.
const (
	ProviderOpenAI    = "openai"
	ProviderAnthropic = "anthropic"
	ProviderGoogle    = "google"
	ProviderOllama    = "ollama"
	ProviderQwen      = "qwen"
	ProviderZhipu     = "zhipu"
	ProviderMiniMax   = "minimax"
	ProviderMoonshot  = "moonshot"
)

// ProviderInfo holds metadata about a supported provider.
type ProviderInfo struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Website     string   `json:"website"`
	Models      []string `json:"models"`
	APIStyle    string   `json:"api_style"`
}

// SupportedProviders returns metadata for all supported providers.
func SupportedProviders() []ProviderInfo {
	return []ProviderInfo{
		{
			ID:          ProviderOpenAI,
			Name:        "OpenAI",
			Description: "GPT-4o, GPT-4, GPT-3.5-turbo and more",
			Website:     "https://openai.com",
			Models:      []string{"gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"},
			APIStyle:    "openai",
		},
		{
			ID:          ProviderAnthropic,
			Name:        "Anthropic",
			Description: "Claude 3.5 Sonnet, Claude 3 Opus, Haiku",
			Website:     "https://anthropic.com",
			Models:      []string{"claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"},
			APIStyle:    "anthropic",
		},
		{
			ID:          ProviderGoogle,
			Name:        "Google",
			Description: "Gemini 1.5 Pro, Gemini 1.5 Flash",
			Website:     "https://ai.google.dev",
			Models:      []string{"gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"},
			APIStyle:    "google",
		},
		{
			ID:          ProviderOllama,
			Name:        "Ollama",
			Description: "Run local models (Llama 3, Mistral, etc.)",
			Website:     "https://ollama.ai",
			Models:      []string{"llama3", "mistral", "codellama", "phi3"},
			APIStyle:    "openai",
		},
		{
			ID:          ProviderQwen,
			Name:        "Qwen (Alibaba)",
			Description: "Qwen-Max, Qwen-Plus, Qwen-Turbo",
			Website:     "https://dashscope.aliyun.com",
			Models:      []string{"qwen-max", "qwen-plus", "qwen-turbo"},
			APIStyle:    "dashscope",
		},
		{
			ID:          ProviderZhipu,
			Name:        "Zhipu AI",
			Description: "GLM-4, GLM-4-Flash",
			Website:     "https://open.bigmodel.cn",
			Models:      []string{"glm-4", "glm-4-flash", "glm-3-turbo"},
			APIStyle:    "zhipu",
		},
		{
			ID:          ProviderMiniMax,
			Name:        "MiniMax",
			Description: "abab6.5-chat, abab5.5-chat",
			Website:     "https://api.minimax.chat",
			Models:      []string{"abab6.5-chat", "abab5.5-chat"},
			APIStyle:    "minimax",
		},
		{
			ID:          ProviderMoonshot,
			Name:        "Moonshot (Kimi)",
			Description: "moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k",
			Website:     "https://platform.moonshot.cn",
			Models:      []string{"moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"},
			APIStyle:    "openai",
		},
	}
}
