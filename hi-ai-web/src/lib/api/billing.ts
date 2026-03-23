import { apiClient } from './client';

// Types
export interface Balance {
  tenant_id: string;
  token_balance: number;
  total_recharged: number;
  total_consumed: number;
  updated_at: string;
}

export interface Transaction {
  id: string;
  tenant_id: string;
  type: 'recharge' | 'consume' | 'refund';
  amount: number;
  balance_after: number;
  description: string;
  reference_id?: string;
  created_at: string;
}

export interface TransactionList {
  transactions: Transaction[];
  total: number;
  page: number;
  per_page: number;
}

export interface RechargePackage {
  id: string;
  name: string;
  amount_cents: number;
  token_amount: number;
  currency: string;
}

export interface RechargeResponse {
  order_no: string;
  checkout_url?: string;
}

// API functions
export async function getBalance(): Promise<Balance> {
  return apiClient.get<Balance>('/api/billing/balance');
}

export async function getTransactions(page: number = 1, perPage: number = 20): Promise<TransactionList> {
  return apiClient.get<TransactionList>(`/api/billing/transactions?page=${page}&per_page=${perPage}`);
}

export async function getPackages(): Promise<RechargePackage[]> {
  interface PackagesResponse {
    packages: RechargePackage[];
  }
  const response = await apiClient.get<PackagesResponse>('/api/billing/packages');
  return response.packages;
}

export async function createRecharge(packageId: string, method: string): Promise<RechargeResponse> {
  return apiClient.post<RechargeResponse>('/api/billing/recharge', {
    package_id: packageId,
    method: method,
  });
}
