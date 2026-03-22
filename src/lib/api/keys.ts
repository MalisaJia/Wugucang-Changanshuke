import { apiClient } from './client';

export interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  status: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

export interface CreateKeyRequest {
  name: string;
  expires_in_days?: number;
}

export interface CreateKeyResponse {
  id: string;
  key: string; // full key shown once only
  name: string;
  created_at: string;
}

export async function listKeys(): Promise<APIKey[]> {
  return apiClient.get<APIKey[]>('/api/keys');
}

export async function createKey(data: CreateKeyRequest): Promise<CreateKeyResponse> {
  return apiClient.post<CreateKeyResponse>('/api/keys', data);
}

export async function revokeKey(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/keys/${id}`);
}
