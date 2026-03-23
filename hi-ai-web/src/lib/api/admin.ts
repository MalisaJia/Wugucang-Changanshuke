import { apiClient } from './client';

// Types
export interface AdminUser {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  balance: number;
  created_at: string;
  last_login_at?: string;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  per_page: number;
}

export interface AdminStats {
  total_users: number;
  total_revenue: number;
  total_requests: number;
  active_users_today: number;
  recent_users: AdminUser[];
  recent_transactions: Transaction[];
}

export interface UserBalance {
  tenant_id: string;
  token_balance: number;
  total_recharged: number;
  total_consumed: number;
}

export interface Transaction {
  id: string;
  tenant_id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  reference_id?: string;
  created_at: string;
}

export interface RefundTransactionsResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  per_page: number;
}

export interface AdjustBalanceRequest {
  adjustment: number;
  reason: string;
}

export interface ProcessRefundRequest {
  user_id: string;
  amount: number;
  reason: string;
}

// API Functions

/**
 * Get system-level statistics for admin dashboard
 */
export async function getAdminStats(): Promise<AdminStats> {
  return apiClient.get<AdminStats>('/api/admin/stats');
}

/**
 * Get paginated list of all users across tenants
 */
export async function getAdminUsers(params: {
  page?: number;
  per_page?: number;
  search?: string;
}): Promise<AdminUsersResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.per_page) searchParams.set('per_page', params.per_page.toString());
  if (params.search) searchParams.set('search', params.search);
  
  const query = searchParams.toString();
  return apiClient.get<AdminUsersResponse>(`/api/admin/users${query ? `?${query}` : ''}`);
}

/**
 * Get balance for a specific user/tenant
 */
export async function getUserBalance(tenantId: string): Promise<UserBalance> {
  return apiClient.get<UserBalance>(`/api/admin/users/${tenantId}/balance`);
}

/**
 * Adjust user balance (positive = add, negative = deduct)
 */
export async function adjustUserBalance(
  tenantId: string,
  data: AdjustBalanceRequest
): Promise<{ success: boolean; message: string }> {
  return apiClient.put<{ success: boolean; message: string }>(
    `/api/admin/users/${tenantId}/balance`,
    data
  );
}

/**
 * Get paginated list of refund/adjustment transactions
 */
export async function getRefundRequests(params: {
  page?: number;
  per_page?: number;
}): Promise<RefundTransactionsResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.per_page) searchParams.set('per_page', params.per_page.toString());
  
  const query = searchParams.toString();
  return apiClient.get<RefundTransactionsResponse>(`/api/admin/refund-requests${query ? `?${query}` : ''}`);
}

/**
 * Process a refund for a user
 */
export async function processRefund(
  data: ProcessRefundRequest
): Promise<{ success: boolean; message: string }> {
  return apiClient.post<{ success: boolean; message: string }>('/api/admin/refund', data);
}
