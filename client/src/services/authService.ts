/**
 * FitBuddy 認證服務層
 * 
 * 統一的認證 API 服務，使用 React Query + Axios
 * 提供所有認證相關的 API 調用和 React Query hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, type RefreshTokenResponse } from '@/lib/api-client';
import type { AppApiError } from '@/lib/api-error';
import type { AuthApiResponse, MePayload } from '@/types/auth-payload';
import { queryClient } from '@/lib/queryClient';

// ========== 類型定義 ==========

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: 'client' | 'coach' | 'admin';
  coachRef?: string | null;
}

export interface VerifyEmailData {
  token: string;
}

export interface ResendVerificationData {
  email: string;
}

export interface SelectRoleData {
  role: 'client' | 'coach' | 'admin';
}

export interface ApplyCoachRefResponse {
  success: boolean;
  linked: boolean;
  alreadyLinked?: boolean;
  coachId?: string;
}

// ========== API 方法 ==========

/**
 * 認證服務對象
 * 所有方法都使用統一的 request helper
 */
export const authService = {
  /**
   * 用戶登入
   */
  async login(credentials: LoginCredentials): Promise<AuthApiResponse> {
    return request.post<AuthApiResponse>('/api/auth/login', credentials);
  },

  /**
   * 用戶註冊
   */
  async register(data: RegisterData): Promise<AuthApiResponse> {
    return request.post<AuthApiResponse>('/api/auth/register', data);
  },

  /**
   * 獲取當前用戶信息
   */
  async getMe(): Promise<MePayload> {
    return request.get<MePayload>('/api/auth/me');
  },

  /**
   * 刷新 Access Token
   */
  async refreshToken(): Promise<RefreshTokenResponse> {
    return request.post<RefreshTokenResponse>('/api/auth/refresh', {});
  },

  /**
   * 選擇用戶角色
   */
  async selectRole(role: SelectRoleData['role']): Promise<AuthApiResponse> {
    return request.post<AuthApiResponse>('/api/auth/role-select', { role });
  },

  /**
   * 驗證郵箱
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message?: string }> {
    return request.get<{ success: boolean; message?: string }>(
      `/api/auth/verify-email/${token}`
    );
  },

  /**
   * 重新發送驗證郵件
   */
  async resendVerification(email: string): Promise<{ success: boolean; message?: string }> {
    return request.post<{ success: boolean; message?: string }>(
      '/api/v1/auth/resend-verification',
      { email }
    );
  },

  /**
   * 檢查郵箱驗證狀態
   */
  async checkEmailVerification(email: string): Promise<{ verified: boolean }> {
    return request.get<{ verified: boolean }>(
      `/api/v1/auth/check-verification?email=${encodeURIComponent(email)}`
    );
  },

  async applyCoachRef(coachRef: string): Promise<ApplyCoachRefResponse> {
    return request.post<ApplyCoachRefResponse>('/api/auth/apply-coach-ref', {
      coachRef,
    });
  },

  async loginWithGoogle(code: string, flow: 'login' | 'register' = 'login'): Promise<AuthApiResponse> {
    return request.post<AuthApiResponse>('/api/auth/google/callback', {
      code,
      flow,
    });
  },

  /**
   * 用戶登出（清除 token）
   */
  logout(): void {
    // 清除 React Query 緩存
    queryClient.clear();
    // apiClient 的 logout 方法會清除 localStorage 中的 token
    // 這裡不需要額外的 API 調用
  },
};

// ========== React Query Hooks ==========

/**
 * Hook: 用戶登入 Mutation
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: (data) => {
      // 登入成功後，使認證相關查詢失效，強制重新獲取
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error: any) => {
      console.error('Login error:', error);
    },
  });
}

/**
 * Hook: 用戶註冊 Mutation
 */
export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterData) => authService.register(data),
    onError: (error: any) => {
      console.error('Registration error:', error);
      
      // 處理用戶已存在的情況
      const apiError = error as Partial<AppApiError>;
      if (
        apiError.errorCode === 'USER_ALREADY_EXISTS'
      ) {
        console.log('[useRegister] User already exists, redirecting to /login');
        // 顯示錯誤訊息後重定向到登入頁面
        setTimeout(() => {
          window.location.replace('/login');
        }, 1000);
      }
    },
  });
}

/**
 * Hook: 獲取當前用戶信息 Query
 */
export function useMe() {
  return useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: () => authService.getMe(),
    retry: false, // 不重試，避免無限循環
    staleTime: 5 * 60 * 1000, // 5 分鐘內認為數據新鮮
  });
}

/**
 * Hook: 刷新 Token Mutation
 */
export function useRefreshToken() {
  return useMutation({
    mutationFn: () => authService.refreshToken(),
    onError: (error: any) => {
      console.error('Token refresh error:', error);
    },
  });
}

/**
 * Hook: 選擇角色 Mutation
 */
export function useSelectRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (role: SelectRoleData['role']) => authService.selectRole(role),
    onSuccess: () => {
      // 角色選擇成功後，重新獲取用戶信息
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error: any) => {
      console.error('Role selection error:', error);
    },
  });
}

/**
 * Hook: 驗證郵箱 Mutation
 */
export function useVerifyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => authService.verifyEmail(token),
    onSuccess: () => {
      // 驗證成功後，重新獲取用戶信息
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error: any) => {
      console.error('Email verification error:', error);
    },
  });
}

/**
 * Hook: 重新發送驗證郵件 Mutation
 */
export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => authService.resendVerification(email),
    onError: (error: any) => {
      console.error('Resend verification error:', error);
    },
  });
}

/**
 * Hook: 檢查郵箱驗證狀態 Query
 */
export function useCheckEmailVerification(email: string | null) {
  return useQuery({
    queryKey: ['/api/v1/auth/check-verification', email],
    queryFn: () => {
      if (!email) throw new Error('Email is required');
      return authService.checkEmailVerification(email);
    },
    enabled: !!email, // 僅在 email 存在時啟用
    retry: false,
    staleTime: 30 * 1000, // 30 秒內認為數據新鮮
  });
}

// ========== 導出 ==========

export default authService;
