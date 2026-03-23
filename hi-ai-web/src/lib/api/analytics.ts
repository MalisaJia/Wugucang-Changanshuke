import { apiClient } from './client';

// Types
export interface DailyStats {
  date: string;
  tokens_in: number;
  tokens_out: number;
  tokens_total: number;
  request_count: number;
}

export interface ModelStats {
  model: string;
  tokens_in: number;
  tokens_out: number;
  tokens_total: number;
  request_count: number;
}

export interface UsageSummary {
  today_tokens_in: number;
  today_tokens_out: number;
  today_tokens_total: number;
  today_requests: number;
  month_tokens_in: number;
  month_tokens_out: number;
  month_tokens_total: number;
  month_requests: number;
  daily_stats: DailyStats[];
  model_stats: ModelStats[];
}

export interface UsageLog {
  id: string;
  tenant_id: string;
  api_key_id?: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  tokens_total: number;
  latency_ms: number;
  created_at: string;
}

export interface UsageLogsResponse {
  logs: UsageLog[];
  total: number;
  page: number;
  per_page: number;
}

// API functions
export async function getUsageSummary(days: number = 7): Promise<UsageSummary> {
  return apiClient.get<UsageSummary>(`/api/billing/usage-summary?days=${days}`);
}

export async function getUsageLogs(page: number = 1, perPage: number = 20): Promise<UsageLogsResponse> {
  return apiClient.get<UsageLogsResponse>(`/api/billing/usage-logs?page=${page}&per_page=${perPage}`);
}
