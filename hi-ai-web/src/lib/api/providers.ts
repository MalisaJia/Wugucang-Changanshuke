import { apiClient } from './client';

// Provider config returned from API
export interface ProviderConfig {
  id: string;
  provider_id: string;
  base_url?: string;
  enabled: boolean;
  priority: number;
  weight: number;
  has_api_key: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Provider with config
export interface Provider {
  id: string;
  name: string;
  description: string;
  website: string;
  models: string[];
  api_style: string;
  config?: ProviderConfig;
}

export interface ProvidersResponse {
  providers: Provider[];
}

// Request types
export interface UpdateProviderData {
  enabled?: boolean;
  api_key?: string;
  base_url?: string;
  priority?: number;
  weight?: number;
  settings?: Record<string, unknown>;
}

// Provider templates for quick setup
export const PROVIDER_TEMPLATES: Record<string, { base_url: string; models: string[] }> = {
  openai: {
    base_url: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  },
  anthropic: {
    base_url: 'https://api.anthropic.com',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  },
  google: {
    base_url: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
  },
  qwen: {
    base_url: 'https://dashscope.aliyuncs.com/api/v1',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  },
  zhipu: {
    base_url: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4', 'glm-4-flash', 'glm-3-turbo'],
  },
  moonshot: {
    base_url: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
};

/**
 * Get all providers and their configurations
 */
export async function getProviders(): Promise<Provider[]> {
  const response = await apiClient.get<ProvidersResponse>('/api/providers');
  return response.providers;
}

/**
 * Update a provider's configuration (creates if doesn't exist)
 */
export async function updateProvider(
  providerId: string,
  data: UpdateProviderData
): Promise<ProviderConfig> {
  return apiClient.put<ProviderConfig>(`/api/providers/${providerId}`, data);
}

/**
 * Quick toggle provider enabled status
 */
export async function toggleProvider(
  providerId: string,
  enabled: boolean
): Promise<ProviderConfig> {
  return updateProvider(providerId, { enabled });
}

/**
 * Mask API key for display (show first 4 and last 4 chars)
 */
export function maskApiKey(hasKey: boolean): string {
  if (!hasKey) return '—';
  return '••••••••••••';
}

/**
 * Mask base URL for display
 */
export function maskBaseUrl(url?: string): string {
  if (!url) return '—';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/...`;
  } catch {
    return url.slice(0, 30) + '...';
  }
}
