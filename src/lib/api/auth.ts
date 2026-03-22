import { apiClient } from './client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
  team_name: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
  tenant_id: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export async function loginAPI(data: LoginRequest): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/login', data);
}

export async function registerAPI(data: RegisterRequest): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/register', data);
}

export async function refreshTokenAPI(refreshToken: string): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/refresh', { refresh_token: refreshToken });
}
