const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface ApiError {
  error: {
    code: string;
    message: string;
    type?: string;
  };
}

export class ApiClientError extends Error {
  code: string;
  type?: string;

  constructor(apiError: ApiError['error']) {
    super(apiError.message);
    this.name = 'ApiClientError';
    this.code = apiError.code;
    this.type = apiError.type;
  }
}

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Refresh the access token using the refresh token
async function refreshAccessToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const tokens = JSON.parse(localStorage.getItem('auth-tokens') || '{}');
  if (!tokens.refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refreshToken }),
    });

    if (!response.ok) {
      // Refresh failed, clear tokens and redirect to login
      localStorage.removeItem('auth-tokens');
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
      return false;
    }

    const data = await response.json();
    // Update stored tokens
    localStorage.setItem(
      'auth-tokens',
      JSON.stringify({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      })
    );

    // Also update zustand store if it exists
    const authStorage = JSON.parse(localStorage.getItem('auth-storage') || '{}');
    if (authStorage.state) {
      authStorage.state.accessToken = data.access_token;
      authStorage.state.refreshToken = data.refresh_token;
      authStorage.state.user = data.user;
      localStorage.setItem('auth-storage', JSON.stringify(authStorage));
    }

    return true;
  } catch {
    localStorage.removeItem('auth-tokens');
    localStorage.removeItem('auth-storage');
    window.location.href = '/login';
    return false;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): HeadersInit {
    // Get token from localStorage (only on client-side)
    const tokens =
      typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('auth-tokens') || '{}')
        : {};
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (tokens.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }
    return headers;
  }

  private async handleResponse<T>(response: Response, retryFn?: () => Promise<T>): Promise<T> {
    if (!response.ok) {
      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && retryFn) {
        // Ensure only one refresh happens at a time
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = refreshAccessToken();
        }

        const refreshed = await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;

        if (refreshed) {
          // Retry the original request with new token
          return retryFn();
        }
      }

      let errorData: ApiError;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          error: {
            code: 'UNKNOWN_ERROR',
            message: `Request failed with status ${response.status}`,
          },
        };
      }
      throw new ApiClientError(errorData.error);
    }
    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    const makeRequest = async (): Promise<T> => {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<T>(response, makeRequest);
    };
    return makeRequest();
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const makeRequest = async (): Promise<T> => {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response, makeRequest);
    };
    return makeRequest();
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const makeRequest = async (): Promise<T> => {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response, makeRequest);
    };
    return makeRequest();
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const makeRequest = async (): Promise<T> => {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response, makeRequest);
    };
    return makeRequest();
  }

  async delete<T>(path: string): Promise<T> {
    const makeRequest = async (): Promise<T> => {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<T>(response, makeRequest);
    };
    return makeRequest();
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
