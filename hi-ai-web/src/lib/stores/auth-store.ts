'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { loginAPI, registerAPI, type User } from '@/lib/api/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    display_name: string;
    team_name: string;
  }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  refreshAccessToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await loginAPI({ email, password });
          set({
            user: res.user,
            accessToken: res.access_token,
            refreshToken: res.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });
          // Also store tokens for API client
          if (typeof window !== 'undefined') {
            localStorage.setItem(
              'auth-tokens',
              JSON.stringify({
                accessToken: res.access_token,
                refreshToken: res.refresh_token,
              })
            );
          }
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Login failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const res = await registerAPI(data);
          set({
            user: res.user,
            accessToken: res.access_token,
            refreshToken: res.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });
          // Also store tokens for API client
          if (typeof window !== 'undefined') {
            localStorage.setItem(
              'auth-tokens',
              JSON.stringify({
                accessToken: res.access_token,
                refreshToken: res.refresh_token,
              })
            );
          }
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Registration failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-tokens');
        }
      },

      clearError: () => set({ error: null }),

      refreshAccessToken: async () => {
        const state = useAuthStore.getState();
        if (!state.refreshToken) return false;

        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: state.refreshToken }),
          });

          if (!response.ok) {
            // Refresh failed, logout user
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              error: null,
            });
            if (typeof window !== 'undefined') {
              localStorage.removeItem('auth-tokens');
            }
            return false;
          }

          const data = await response.json();
          set({
            user: data.user,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            isAuthenticated: true,
          });

          // Also update auth-tokens for API client
          if (typeof window !== 'undefined') {
            localStorage.setItem(
              'auth-tokens',
              JSON.stringify({
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
              })
            );
          }

          return true;
        } catch {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth-tokens');
          }
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
