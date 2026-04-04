import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { logger } from './logger';
import { offlineManager } from './offline-manager';
import type {
  AuthApiResponse,
  MePayload,
} from '@/types/auth-payload';

// ========== 類型定義 ==========
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

/** GET /api/auth/me 回傳格式（含註冊狀態） */
export type MeResponse = MePayload;

// Logger 已從 './logger' 導入

// ========== Token 管理 ==========
const ACCESS_TOKEN_KEY = 'fitbuddy_access_token';
const REFRESH_TOKEN_KEY = 'fitbuddy_refresh_token';

export const tokenManager = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => localStorage.setItem(ACCESS_TOKEN_KEY, token),
  
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => localStorage.setItem(REFRESH_TOKEN_KEY, token),
  
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    // 同時清除舊的 authToken（向後兼容）
    localStorage.removeItem('authToken');
  },

  // ✨ 企業級：檢查 token 是否過期
  isAccessTokenExpired: () => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // 轉換為毫秒
      return Date.now() >= expirationTime - 60000; // 提前 1 分鐘刷新
    } catch {
      return true;
    }
  },
};

// ========== Base URL 正規化 ==========
// VITE_API_BASE_URL 可能是：(1) 完整 server URL (2) 相對路徑如 /api (3) 未設置
// 若為相對路徑或未設置，使用 origin 或 fallback，避免拼出 /api/api/... 錯誤
const DEFAULT_ORIGIN = 'http://localhost:3000';

function getApiBaseURL(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    return DEFAULT_ORIGIN;
  }
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, '');
  }
  // 相對路徑（如 /api）→ 使用當前頁面 origin，避免 /api + /api/auth/refresh = /api/api/auth/refresh
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return DEFAULT_ORIGIN;
}

// ========== Axios 實例 ==========
export const apiClient: AxiosInstance = axios.create({
  baseURL: getApiBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 秒超時
});

// ========== 企業級：Token 刷新管理 ==========
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

// ========== 企業級：重試邏輯 ==========
interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1 秒
  backoffMultiplier: 2, // 指數退避
};

const shouldRetry = (error: any, retryCount: number, config: RetryConfig) => {
  // 不重試 4xx 錯誤（除了 429 和 503）
  if (error.response?.status >= 400 && error.response?.status < 500) {
    if (![429, 503].includes(error.response.status)) {
      return false;
    }
  }

  // 不重試認證錯誤（除了 token 過期）
  if (error.response?.status === 401 && !error.response?.data?.error?.includes('token')) {
    return false;
  }

  return retryCount < config.maxRetries;
};

/** 註冊前公開查詢，不應帶過期 access 或觸發 refresh（避免未登入／註冊頁被導去 /login） */
function isPublicUsernameCheckRequest(config: { url?: string }): boolean {
  const u = config.url ?? "";
  return u.includes("/api/v1/users/check-username");
}

// ========== 請求攔截器 ==========
apiClient.interceptors.request.use(
  async (config) => {
    const publicUsernameCheck = isPublicUsernameCheckRequest(config);

    // ✨ 企業級：在發送請求前檢查 token 是否即將過期
    if (!publicUsernameCheck && tokenManager.isAccessTokenExpired()) {
      const refreshToken = tokenManager.getRefreshToken();
      if (refreshToken) {
        try {
          const response = await axios.post<RefreshTokenResponse>(
            `${getApiBaseURL()}/api/auth/refresh`,
            { refreshToken }
          );
          tokenManager.setAccessToken(response.data.token);
          tokenManager.setRefreshToken(response.data.refreshToken);
          
          // ✅ 更新當前請求的 Authorization header
          config.headers.Authorization = `Bearer ${response.data.token}`;
        } catch (error) {
          // 刷新失敗，清除 token
          tokenManager.clear();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      }
    }

    // 添加 Authorization header（公開 check-username 不附帶 token）
    if (!publicUsernameCheck) {
      const token = tokenManager.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    // ✨ 企業級：添加請求 ID 用於追蹤
    config.headers['X-Request-ID'] = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return config;
  },
  (error) => Promise.reject(error)
);

// ========== 響應攔截器 ==========
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // ✨ 企業級：詳細的錯誤日誌
    logger.error('API Client', 'API Error', {
      status: error.response?.status,
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
      requestId: error.config?.headers?.['X-Request-ID'],
      timestamp: new Date().toISOString(),
    });

    // ========== 401 錯誤處理 - Token 過期 ==========
    if (
      error.response?.status === 401 &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !isPublicUsernameCheckRequest(originalRequest) &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;

        try {
          const refreshToken = tokenManager.getRefreshToken();
          if (!refreshToken) {
            throw new Error('No refresh token');
          }

          // 調用 refresh 端點
          const response = await axios.post<RefreshTokenResponse>(
            `${getApiBaseURL()}/api/auth/refresh`,
            { refreshToken }
          );

          const newAccessToken = response.data.token;
          const newRefreshToken = response.data.refreshToken;

          tokenManager.setAccessToken(newAccessToken);
          tokenManager.setRefreshToken(newRefreshToken);

          // 通知所有等待的請求
          onRefreshed(newAccessToken);

          // ✅ 更新原始請求的 Authorization header
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          // 重試原始請求
          return apiClient(originalRequest);
        } catch (refreshError: any) {
          logger.error('API Client', 'Token refresh failed', {
            error: refreshError.message,
            timestamp: new Date().toISOString(),
          });

          // 刷新失敗，清除 token 並重定向到登入
          tokenManager.clear();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // 如果正在刷新，等待新 token
      return new Promise((resolve) => {
        addRefreshSubscriber((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(originalRequest));
        });
      });
    }

    // ========== 離線支持 ==========
    // 如果用戶離線且請求失敗，將請求添加到離線隊列
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
      
      // 返回一個特殊的錯誤，讓調用者知道請求已排隊
      return Promise.reject({
        ...error,
        isQueued: true,
        message: 'Request queued for offline processing',
      });
    }

    // ========== 其他 5xx 錯誤 - 重試 ==========
    if (
      !originalRequest._retryCount &&
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

    return Promise.reject(error);
  }
);

// ========== API 方法 ==========
export const api = {
  auth: {
    login: (email: string, password: string) => {
      // ✅ 嚴格類型驗證：確保 email 和 password 是字符串
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

      // ✅ 確保是字符串並去除空白（在驗證後）
      const emailStr = email.trim();
      const passwordStr = password.trim();

      // ✅ 驗證不是空字符串
      if (!emailStr || !passwordStr) {
        const error = new Error('Email and password cannot be empty');
        logger.error('API Client', 'Empty login parameters', {
          emailLength: emailStr.length,
          passwordLength: passwordStr.length,
          timestamp: new Date().toISOString(),
        });
        return Promise.reject(error);
      }

      // ✅ 確保請求體格式正確：直接傳遞 email 和 password，不要嵌套
      const requestBody = { 
        email: emailStr, 
        password: passwordStr 
      };
      
      logger.info('API Client', 'Login request', { 
        url: '/api/auth/login', 
        bodyKeys: Object.keys(requestBody),
        emailLength: emailStr.length,
        passwordLength: passwordStr.length,
        hasPassword: !!passwordStr,
        timestamp: new Date().toISOString(),
      });
      
      // ✅ 確保使用正確的 Content-Type 和數據格式
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

    // ✨ 企業級：刷新 token
    refresh: (refreshToken: string) =>
      apiClient.post<RefreshTokenResponse>('/api/auth/refresh', { refreshToken }),

    logout: () => {
      tokenManager.clear();
      return Promise.resolve();
    },
  },

  // 其他 API 端點...
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

