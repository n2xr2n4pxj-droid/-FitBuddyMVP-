import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { logger } from './logger';
import { offlineManager } from './offline-manager';
import { createAppApiError, extractErrorPayload, type AppApiError } from './api-error';
import type { AuthApiResponse, MePayload } from '@/types/auth-payload';

export type AuthResponse = AuthApiResponse;

export interface RefreshTokenResponse {
  success?: boolean;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ApiErrorResponse {
  error?: string;
  message?: string;
}

export type MeResponse = MePayload;

const ACCESS_TOKEN_KEY = 'fitbuddy_access_token';
const REFRESH_TOKEN_KEY = 'fitbuddy_refresh_token';
const LEGACY_ACCESS_TOKEN_KEY = 'fitbuddy_token';
const LEGACY_AUTH_TOKEN_KEY = 'authToken';
const DEFAULT_ORIGIN = 'http://localhost:3000';
const DEV = import.meta.env.DEV;

function devLog(message: string, data?: unknown) {
  if (!DEV) return;
  console.debug(`[apiClient] ${message}`, data ?? '');
}

function migrateLegacyAccessToken() {
  if (typeof window === 'undefined') return;

  const current = localStorage.getItem(ACCESS_TOKEN_KEY);
  const legacyFitbuddy = localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
  const legacyAuth = localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
  const fallback = current || legacyFitbuddy || legacyAuth;

  if (fallback && !current) {
    localStorage.setItem(ACCESS_TOKEN_KEY, fallback);
  }

  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
}

export const tokenManager = {
  getAccessToken: () => {
    migrateLegacyAccessToken();
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  setAccessToken: (token: string) => localStorage.setItem(ACCESS_TOKEN_KEY, token),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => localStorage.setItem(REFRESH_TOKEN_KEY, token),
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  },
  isAccessTokenExpired: () => {
    const token = tokenManager.getAccessToken();
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000;
      return Date.now() >= expirationTime - 60000;
    } catch {
      return true;
    }
  },
};

export function getApiBaseURL(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    return DEFAULT_ORIGIN;
  }
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return DEFAULT_ORIGIN;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: getApiBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;
let pendingRefreshWaiters = 0;

interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
};

const shouldRetry = (error: AxiosError, retryCount: number, config: RetryConfig) => {
  if (error.response?.status !== undefined && error.response.status >= 400 && error.response.status < 500) {
    if (![429, 503].includes(error.response.status)) {
      return false;
    }
  }

  if (
    error.response?.status === 401 &&
    !String(error.response?.data ?? '').toLowerCase().includes('token')
  ) {
    return false;
  }

  return retryCount < config.maxRetries;
};

function isPublicUsernameCheckRequest(config: { url?: string }): boolean {
  const url = config.url ?? '';
  return url.includes('/api/v1/users/check-username');
}

async function performTokenRefresh(): Promise<string> {
  const refreshToken = tokenManager.getRefreshToken();
  if (!refreshToken) {
    throw createAppApiError({ message: 'No refresh token', statusCode: 401 });
  }

  const response = await axios.post<RefreshTokenResponse>(
    `${getApiBaseURL()}/api/auth/refresh`,
    { refreshToken }
  );

  tokenManager.setAccessToken(response.data.token);
  tokenManager.setRefreshToken(response.data.refreshToken);
  return response.data.token;
}

async function getRefreshedTokenSingleFlight(context?: { url?: string; source?: 'request' | 'response' }): Promise<string> {
  if (!refreshPromise) {
    isRefreshing = true;
    devLog('refresh started', {
      source: context?.source,
      url: context?.url,
    });
    refreshPromise = performTokenRefresh()
      .then((token) => {
        devLog('refresh done — releasing queue', {
          queueLength: pendingRefreshWaiters,
        });
        return token;
      })
      .catch((refreshErr) => {
        devLog('refresh failed — logging out', refreshErr);
        throw refreshErr;
      })
      .finally(() => {
        isRefreshing = false;
        refreshPromise = null;
        pendingRefreshWaiters = 0;
      });
    return refreshPromise;
  }

  pendingRefreshWaiters += 1;
  devLog('queued — waiting for refresh', {
    source: context?.source,
    url: context?.url,
    queueLength: pendingRefreshWaiters,
  });
  try {
    return await refreshPromise;
  } finally {
    pendingRefreshWaiters = Math.max(0, pendingRefreshWaiters - 1);
  }
}

export function migrateTokenKeys(): void {
  migrateLegacyAccessToken();
}

apiClient.interceptors.request.use(
  async (config) => {
    const publicUsernameCheck = isPublicUsernameCheckRequest(config);

    if (!publicUsernameCheck && tokenManager.isAccessTokenExpired() && tokenManager.getRefreshToken()) {
      try {
        const refreshedToken = await getRefreshedTokenSingleFlight({
          source: 'request',
          url: config.url,
        });
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${refreshedToken}`;
      } catch {
        tokenManager.clear();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }

    if (!publicUsernameCheck) {
      const token = tokenManager.getAccessToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    config.headers = config.headers || {};
    config.headers['X-Request-ID'] = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = (error.config ?? {}) as AxiosRequestConfig & {
      _retry?: boolean;
      _retryCount?: number;
      headers?: Record<string, string>;
    };

    logger.error('API Client', 'API Error', {
      status: error.response?.status,
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
      requestId: error.config?.headers?.['X-Request-ID'],
      timestamp: new Date().toISOString(),
    });

    if (
      error.response?.status === 401 &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !isPublicUsernameCheckRequest(originalRequest) &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        const newAccessToken = await getRefreshedTokenSingleFlight({
          source: 'response',
          url: originalRequest.url,
        });
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        logger.error('API Client', 'Token refresh failed', {
          error: refreshError instanceof Error ? refreshError.message : String(refreshError),
          timestamp: new Date().toISOString(),
        });

        tokenManager.clear();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(normalizeApiError(refreshError));
      }
    }

    if (!offlineManager.getIsOnline() && originalRequest) {
      offlineManager.addToQueue(
        originalRequest.method || 'GET',
        originalRequest.url || '',
        originalRequest.data
      );

      logger.warn('API Client', 'Request queued for offline processing', {
        method: originalRequest.method,
        url: originalRequest.url,
      });

      return Promise.reject(
        createAppApiError({
          message: 'Request queued for offline processing',
          statusCode: error.response?.status,
          isQueued: true,
          details: error,
        })
      );
    }

    if (
      originalRequest._retryCount === undefined &&
      error.response?.status !== undefined &&
      (error.response.status === 429 || error.response.status >= 500)
    ) {
      originalRequest._retryCount = 0;
    }

    if (shouldRetry(error, originalRequest._retryCount || 0, DEFAULT_RETRY_CONFIG)) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      const delay = DEFAULT_RETRY_CONFIG.retryDelay * Math.pow(
        DEFAULT_RETRY_CONFIG.backoffMultiplier,
        originalRequest._retryCount - 1
      );

      logger.warn('API Client', 'Retrying request', {
        retryCount: originalRequest._retryCount,
        delay,
        url: originalRequest.url,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(originalRequest);
    }

    return Promise.reject(normalizeApiError(error));
  }
);

export function normalizeApiError(error: unknown): AppApiError {
  if (error instanceof Error && error.name === 'AppApiError') {
    return error as AppApiError;
  }

  if (axios.isAxiosError(error)) {
    const payload = extractErrorPayload(error.response?.data);
    return createAppApiError({
      message: payload.message || error.message || 'API request failed',
      statusCode: error.response?.status,
      errorCode: payload.errorCode,
      logId: payload.logId,
      details: payload.details ?? error.response?.data,
    });
  }

  if (error instanceof Error) {
    return createAppApiError({ message: error.message, details: error });
  }

  return createAppApiError({ message: 'Unknown API error', details: error });
}

async function requestData<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await apiClient.request<T>(config);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export const request = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    requestData<T>({ ...config, method: 'GET', url }),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    requestData<T>({ ...config, method: 'POST', url, data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    requestData<T>({ ...config, method: 'PUT', url, data }),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    requestData<T>({ ...config, method: 'PATCH', url, data }),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    requestData<T>({ ...config, method: 'DELETE', url }),
};

export const api = {
  auth: {
    login: (email: string, password: string) => {
      if (typeof email !== 'string' || typeof password !== 'string') {
        const error = new Error('Email and password must be strings');
        logger.error('API Client', 'Invalid login parameters', {
          emailType: typeof email,
          passwordType: typeof password,
          emailValue: email,
          timestamp: new Date().toISOString(),
        });
        return Promise.reject(error);
      }

      const emailStr = email.trim();
      const passwordStr = password.trim();

      if (!emailStr || !passwordStr) {
        const error = new Error('Email and password cannot be empty');
        logger.error('API Client', 'Empty login parameters', {
          emailLength: emailStr.length,
          passwordLength: passwordStr.length,
          timestamp: new Date().toISOString(),
        });
        return Promise.reject(error);
      }

      const requestBody = {
        email: emailStr,
        password: passwordStr,
      };

      logger.info('API Client', 'Login request', {
        url: '/api/auth/login',
        bodyKeys: Object.keys(requestBody),
        emailLength: emailStr.length,
        passwordLength: passwordStr.length,
        hasPassword: !!passwordStr,
        timestamp: new Date().toISOString(),
      });

      return apiClient.post<AuthResponse>('/api/auth/login', requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },

    register: (
      email: string,
      password: string,
      firstName?: string,
      lastName?: string,
      coachRef?: string | null
    ) =>
      apiClient.post<AuthResponse>('/api/auth/register', {
        email,
        password,
        firstName,
        lastName,
        coachRef,
      }),

    selectRole: (role: 'client' | 'coach' | 'both' | 'admin') =>
      apiClient.post<AuthResponse>('/api/auth/role-select', { role }),

    me: () =>
      apiClient.get<MeResponse>('/api/auth/me'),

    refresh: (refreshToken: string) =>
      apiClient.post<RefreshTokenResponse>('/api/auth/refresh', { refreshToken }),

    logout: () => {
      tokenManager.clear();
      return Promise.resolve();
    },
  },

  meals: {
    list: (date?: string) => apiClient.get('/api/meals', { params: { date } }),
    create: (data: any) => apiClient.post('/api/meals', data),
    update: (id: string, data: any) => apiClient.put(`/api/meals/${id}`, data),
    delete: (id: string) => apiClient.delete(`/api/meals/${id}`),
  },

  workouts: {
    list: () => apiClient.get('/api/workouts'),
    create: (data: any) => apiClient.post('/api/workouts', data),
    update: (id: string, data: any) => apiClient.put(`/api/workouts/${id}`, data),
    delete: (id: string) => apiClient.delete(`/api/workouts/${id}`),
  },
};

export default apiClient;

