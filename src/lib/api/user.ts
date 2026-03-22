import { apiClient } from './client';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  tenant_id: string;
  created_at: string;
}

export async function getProfile(): Promise<UserProfile> {
  return apiClient.get<UserProfile>('/api/profile');
}

export async function updateProfile(data: { display_name?: string; email?: string }): Promise<UserProfile> {
  return apiClient.put<UserProfile>('/api/profile', data);
}

export async function changePassword(data: { current_password: string; new_password: string }): Promise<void> {
  return apiClient.put<void>('/api/profile/password', data);
}
