'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { loginAPI, registerAPI, type User } from '@/lib/api/auth';

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
