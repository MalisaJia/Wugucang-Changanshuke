import { apiClient } from './client';

export interface ModelConfig {
  id: string;
  model_id: string;
  display_name: string;
  description: string;
  provider_name: string;
  priority: number;
  visible: boolean;
  tags: string;
  price_input: number;
  price_output: number;
  max_context: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateModelData {
  display_name?: string;
  description?: string;
  priority?: number;
  visible?: boolean;
  tags?: string;
  price_input?: number;
  price_output?: number;
  max_context?: number;
}

export interface PriorityItem {
  id: string;
  priority: number;
}

// Admin endpoints
export async function getAdminModels(): Promise<ModelConfig[]> {
  const data = await apiClient.get<{ models: ModelConfig[] }>('/api/admin/models');
  return data.models;
}

export async function updateModel(id: string, data: UpdateModelData): Promise<ModelConfig> {
  return apiClient.put<ModelConfig>(`/api/admin/models/${id}`, data);
}

export async function toggleModelVisibility(id: string, visible: boolean): Promise<void> {
  await apiClient.post<void>(`/api/admin/models/${id}/toggle`, { visible });
}

export async function reorderModels(items: PriorityItem[]): Promise<void> {
  await apiClient.post<void>('/api/admin/models/reorder', { items });
}

export async function syncModels(): Promise<{ synced: number }> {
  return apiClient.post<{ synced: number }>('/api/admin/models/sync', {});
}

// User endpoint
export async function getVisibleModels(): Promise<ModelConfig[]> {
  const data = await apiClient.get<{ models: ModelConfig[] }>('/api/admin/models');
  return data.models.filter(m => m.visible);
}
