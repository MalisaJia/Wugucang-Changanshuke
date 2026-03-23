import { apiClient } from './client';

// Types
export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address?: string;
  request_summary?: Record<string, unknown>;
  created_at: string;
}

export interface PaginationInfo {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  pagination: PaginationInfo;
}

// API functions
export async function getAuditLogs(
  page: number = 1,
  perPage: number = 20
): Promise<AuditLogsResponse> {
  return apiClient.get<AuditLogsResponse>(
    `/api/audit-logs?page=${page}&per_page=${perPage}`
  );
}
