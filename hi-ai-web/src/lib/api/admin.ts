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

// ============ Payments API ============

export interface AdminPayment {
  id: string;
  tenant_id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  reference_id?: string;
  created_at: string;
}

export interface AdminPaymentsResponse {
  transactions: AdminPayment[];
  total: number;
  page: number;
  per_page: number;
}

/**
 * Get paginated list of all payment transactions
 */
export async function getAdminPayments(params: {
  page?: number;
  per_page?: number;
  status?: string;
  method?: string;
}): Promise<AdminPaymentsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.status) query.set('status', params.status);
  if (params.method) query.set('method', params.method);
  return apiClient.get<AdminPaymentsResponse>(`/api/admin/payments?${query.toString()}`);
}

// ============ API Keys Admin API ============

export interface AdminAPIKey {
  id: string;
  name: string;
  prefix: string;
  tenant_id: string;
  created_at: string;
  last_used_at?: string;
  status: string;
}

export interface AdminAPIKeysResponse {
  keys: AdminAPIKey[];
  total: number;
  page: number;
  per_page: number;
}

/**
 * Get paginated list of all API keys across tenants
 */
export async function getAdminApiKeys(params: {
  page?: number;
  per_page?: number;
  tenant_id?: string;
}): Promise<AdminAPIKeysResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.tenant_id) query.set('tenant_id', params.tenant_id);
  return apiClient.get<AdminAPIKeysResponse>(`/api/admin/api-keys?${query.toString()}`);
}

// ====== Security API ======

export interface PIIRule {
  name: string;
  pattern: string;
  enabled: boolean;
  replacement: string;
  description: string;
}

export interface GuardrailConfig {
  mode: 'block' | 'mask' | 'off';
  rules: PIIRule[];
}

/**
 * Get current guardrail configuration
 */
export async function getGuardrailConfig(): Promise<GuardrailConfig> {
  return apiClient.get<GuardrailConfig>('/api/admin/security/guardrails');
}

/**
 * Update guardrail configuration
 */
export async function updateGuardrailConfig(
  data: GuardrailConfig
): Promise<{ success: boolean; message: string }> {
  return apiClient.put<{ success: boolean; message: string }>('/api/admin/security/guardrails', data);
}

// ====== Routing API ======

export interface RoutingSettings {
  mode: string;
  health_check: {
    window: string;
    error_threshold: number;
  };
}

export interface RetrySettings {
  max_attempts: number;
  initial_backoff: string;
  max_backoff: string;
  backoff_multiplier: number;
}

export interface CircuitBreakerSettings {
  failure_threshold: number;
  success_threshold: number;
  timeout: string;
  window: string;
}

export interface RoutingConfig {
  routing: RoutingSettings;
  retry: RetrySettings;
  circuit_breaker: CircuitBreakerSettings;
}

export interface BreakerStatus {
  key: string;
  state: string;
  failures: number;
}

export interface BreakersResponse {
  breakers: BreakerStatus[];
}

export interface ConditionalRule {
  priority: number;
  conditions: Record<string, unknown>;
  targets: {
    provider_id: string;
    model_id: string;
    weight?: number;
    priority?: number;
  }[];
}

export interface RoutingRulesResponse {
  mode: string;
  rules: ConditionalRule[];
}

/**
 * Get current routing configuration
 */
export async function getRoutingConfig(): Promise<RoutingConfig> {
  return apiClient.get<RoutingConfig>('/api/admin/routing/config');
}

/**
 * Update routing configuration (read-only, requires server restart)
 */
export async function updateRoutingConfig(
  data: { routing?: { mode: string } }
): Promise<{ success: boolean; message: string }> {
  return apiClient.put<{ success: boolean; message: string }>('/api/admin/routing/config', data);
}

/**
 * Get circuit breaker status for all provider:model combinations
 */
export async function getBreakerStatus(): Promise<BreakersResponse> {
  return apiClient.get<BreakersResponse>('/api/admin/routing/breakers');
}

/**
 * Get conditional routing rules
 */
export async function getRoutingRules(): Promise<RoutingRulesResponse> {
  return apiClient.get<RoutingRulesResponse>('/api/admin/routing/rules');
}
