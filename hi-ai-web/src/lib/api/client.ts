const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Default request timeout in milliseconds
const DEFAULT_TIMEOUT_MS = 30000;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

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
  status?: number;

  constructor(apiError: ApiError['error'], status?: number) {
    super(apiError.message);
    this.name = 'ApiClientError';
    this.code = apiError.code;
    this.type = apiError.type;
    this.status = status;
  }
}

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Helper function for exponential backoff delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Check if error is retryable (5xx errors, network failures, or 429 rate limit)
function isRetryableError(error: unknown, status?: number): boolean {
  // Network failure (TypeError: Failed to fetch)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  // Abort errors should not be retried
  if (error instanceof Error && error.name === 'AbortError') {
    return false;
  }
  // Server errors (5xx) and rate limiting (429)
  if (status && (status >= 500 || status === 429)) {
    return true;
  }
  return false;
}

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

// Get shared refresh promise with proper cleanup
function getRefreshPromise(): Promise<boolean> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = refreshAccessToken().finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  }
  return refreshPromise!;
}

class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string, timeout: number = DEFAULT_TIMEOUT_MS) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
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

  // Fetch with timeout using AbortController
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = this.timeout
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Execute request with retry logic for network/server errors
  private async executeWithRetry(
    url: string,
    options: RequestInit,
    retryCount: number = 0
  ): Promise<Response> {
    try {
      return await this.fetchWithTimeout(url, options);
    } catch (error) {
      // Check if we should retry
      if (retryCount < MAX_RETRIES && isRetryableError(error)) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
        await delay(delayMs);
        return this.executeWithRetry(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  private async handleResponse<T>(
    response: Response,
    retryFn?: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    if (!response.ok) {
      // Handle 401 Unauthorized - try to refresh token (BOUNDED to 1 attempt)
      if (response.status === 401 && retryFn && retryCount < 1) {
        const refreshed = await getRefreshPromise();
        if (refreshed) {
          // Retry the original request with new token
          return retryFn();
        }
      }

      // If 401 persists after refresh attempt, clear tokens and redirect to login
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-tokens');
          localStorage.removeItem('auth-storage');
          window.location.href = '/login';
        }
      }

      // Handle retryable server errors (5xx, 429) - only if no retryFn or status is retryable
      if (isRetryableError(null, response.status) && retryCount < MAX_RETRIES && retryFn) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
        await delay(delayMs);
        return retryFn();
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
      throw new ApiClientError(errorData.error, response.status);
    }
    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    const makeRequest = async (retryCount: number = 0): Promise<T> => {
      const response = await this.executeWithRetry(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<T>(response, () => makeRequest(retryCount + 1), retryCount);
    };
    return makeRequest();
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const makeRequest = async (retryCount: number = 0): Promise<T> => {
      const response = await this.executeWithRetry(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response, () => makeRequest(retryCount + 1), retryCount);
    };
    return makeRequest();
  }

  /**
   * POST request for public endpoints (login, register, etc.)
   * Does not include auth headers and does not handle 401 with redirect
   */
  async postPublic<T>(path: string, body: unknown): Promise<T> {
    const response = await this.executeWithRetry(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return this.handlePublicResponse<T>(response);
  }

  /**
   * Handle response for public endpoints - no 401 redirect
   */
  private async handlePublicResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
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
      throw new ApiClientError(errorData.error, response.status);
    }
    return response.json();
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const makeRequest = async (retryCount: number = 0): Promise<T> => {
      const response = await this.executeWithRetry(`${this.baseUrl}${path}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response, () => makeRequest(retryCount + 1), retryCount);
    };
    return makeRequest();
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const makeRequest = async (retryCount: number = 0): Promise<T> => {
      const response = await this.executeWithRetry(`${this.baseUrl}${path}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response, () => makeRequest(retryCount + 1), retryCount);
    };
    return makeRequest();
  }

  async delete<T>(path: string): Promise<T> {
    const makeRequest = async (retryCount: number = 0): Promise<T> => {
      const response = await this.executeWithRetry(`${this.baseUrl}${path}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<T>(response, () => makeRequest(retryCount + 1), retryCount);
    };
    return makeRequest();
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
