import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, tokenManager } from '@/lib/api-client';
import { logger } from '@/lib/logger';

// ========== 類型定義 ==========
export interface User {
  id: string; // 與 API 客戶端保持一致（string 類型）
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  role: 'client' | 'coach' | 'admin' | 'both';
  createdAt: string | null;
  emailVerified?: boolean; // ✅ 郵箱驗證狀態
}

export interface AuthState {
  // ===== 狀態 =====
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  needsVerification: boolean; // ✅ 郵箱驗證標記
  lastRefreshTime: number | null;
  pendingEmail: string | null; // ✅ 待驗證郵箱（註冊後未驗證）

  // ===== Setters =====
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // ===== 操作 =====
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  selectRole: (role: 'client' | 'coach' | 'both' | 'admin') => Promise<void>;
  fetchMe: () => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

// ========== Zustand Store ==========
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // ===== 初始狀態 =====
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      needsVerification: false, // ✅ 郵箱驗證標記
      lastRefreshTime: null,
      pendingEmail: null, // ✅ 待驗證郵箱

      // ===== Setters =====
      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
        if (user) {
          logger.info('AUTH', 'User set', { userId: user.id });
        }
      },

      setToken: (token) => set({ token }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => {
        set({ error });
        if (error) {
          logger.warn('AUTH', 'Error set', { error });
        }
      },

      // ========== 登入 ==========
      login: async function(email: string, password: string) {
        // ✅ 詳細日誌：記錄實際傳入的參數（在類型檢查之前）
        console.log('[auth.store] login called with:', {
          firstArg: arguments[0],
          firstArgType: typeof arguments[0],
          secondArg: arguments[1],
          secondArgType: typeof arguments[1],
          allArgs: Array.from(arguments),
          emailParam: email,
          emailParamType: typeof email,
          passwordParam: password,
          passwordParamType: typeof password,
          timestamp: new Date().toISOString(),
        });

        // ✅ 嚴格類型驗證：確保 email 和 password 是字符串
        if (typeof email !== 'string' || typeof password !== 'string') {
          const error = new Error('Email and password must be strings');
          logger.error('AUTH', 'Invalid login parameters', {
            emailType: typeof email,
            passwordType: typeof password,
            emailValue: email,
            timestamp: new Date().toISOString(),
          });
          set({
            error: error.message,
            isLoading: false,
          });
          throw error;
        }

        // ✅ 在調用 api.auth.login 前確保 trim()
        const trimmedEmail = email.trim();
        const trimmedPassword = password.trim();

        // ✅ 驗證不是空字符串
        if (!trimmedEmail || !trimmedPassword) {
          const error = new Error('Email and password cannot be empty');
          logger.error('AUTH', 'Empty login parameters', {
            emailLength: trimmedEmail.length,
            passwordLength: trimmedPassword.length,
            timestamp: new Date().toISOString(),
          });
          set({
            error: error.message,
            isLoading: false,
          });
          throw error;
        }

        set({ isLoading: true, error: null });
        logger.info('AUTH', 'Login attempt', { 
          email: trimmedEmail.substring(0, 3) + '***',
          emailLength: trimmedEmail.length,
          passwordLength: trimmedPassword.length,
        });

        try {
          const response = await api.auth.login(trimmedEmail, trimmedPassword);
          
          // ✅ 檢查是否需要郵箱驗證
          if (response.data?.needsVerification) {
            const errorMsg = response.data?.error || '請先驗證你的郵箱';
            set({
              error: errorMsg,
              isLoading: false,
              needsVerification: true, // ✅ 添加 needsVerification 標記
            });
            logger.warn('AUTH', 'Email verification required', { email: trimmedEmail });
            throw new Error(errorMsg);
          }

          const { user, token, refreshToken } = response.data;

          tokenManager.setAccessToken(token);
          tokenManager.setRefreshToken(refreshToken);

          set({
            user,
            token,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
            lastRefreshTime: Date.now(),
            needsVerification: false, // ✅ 清除標記
          });

          logger.info('AUTH', 'Login successful', { userId: user.id });
        } catch (err: any) {
          // ✅ 檢查是否是 403 錯誤（郵箱未驗證）
          if (err.response?.status === 403 && err.response?.data?.needsVerification) {
            const errorMsg = err.response?.data?.error || '請先驗證你的郵箱';
            set({
              error: errorMsg,
              isLoading: false,
              needsVerification: true, // ✅ 添加 needsVerification 標記
            });
            logger.warn('AUTH', 'Email verification required', { email: trimmedEmail });
            throw err;
          }

          const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Login failed';
          set({
            error: errorMsg,
            isLoading: false,
            needsVerification: false,
          });
          logger.error('AUTH', 'Login failed', { error: errorMsg });
          throw err;
        }
      },

      // ========== 註冊 ==========
      register: async (email: string, password: string, firstName?: string, lastName?: string) => {
        set({ isLoading: true, error: null });
        logger.info('AUTH', 'Registration attempt', { email });

        try {
          const response = await api.auth.register(email, password, firstName, lastName);
          
          // ✅ 註冊成功後，不自動登錄
          // 清除任何現有的 token 和認證狀態
          tokenManager.clear();

          // ✅ 保存待驗證郵箱，但不設置認證狀態
          set({
            user: null, // 不設置用戶，因為未驗證
            token: null, // 不保存 token
            refreshToken: null, // 不保存 refresh token
            isAuthenticated: false, // ✅ 保持未認證狀態
            isLoading: false,
            lastRefreshTime: null,
            pendingEmail: email, // ✅ 保存待驗證郵箱
            needsVerification: true, // ✅ 標記需要驗證
          });

          logger.info('AUTH', 'Registration successful - awaiting email verification', { email });
        } catch (err: any) {
          const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Registration failed';
          set({
            error: errorMsg,
            isLoading: false,
            pendingEmail: null,
          });
          logger.error('AUTH', 'Registration failed', { error: errorMsg });
          throw err;
        }
      },

      // ========== 角色選擇 ==========
      selectRole: async (role: 'client' | 'coach' | 'both' | 'admin') => {
        set({ isLoading: true, error: null });
        logger.info('AUTH', 'Role selection', { role });

        try {
          const response = await api.auth.selectRole(role);
          const { user, token, refreshToken } = response.data;

          tokenManager.setAccessToken(token);
          tokenManager.setRefreshToken(refreshToken);

          set({
            user,
            token,
            refreshToken,
            isLoading: false,
            lastRefreshTime: Date.now(),
          });

          logger.info('AUTH', 'Role selected successfully', { userId: user.id, role });
        } catch (err: any) {
          const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Role selection failed';
          set({
            error: errorMsg,
            isLoading: false,
          });
          logger.error('AUTH', 'Role selection failed', { error: errorMsg });
          throw err;
        }
      },

      // ========== 獲取當前用戶 ==========
      fetchMe: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await api.auth.me();
          set({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
          });
          logger.info('AUTH', 'User fetched successfully', { userId: response.data.id });
        } catch (err: any) {
          set({
            isLoading: false,
            error: err.message,
          });
          logger.error('AUTH', 'fetchMe failed', { error: err.message });

          // 401 錯誤表示 token 無效
          if (err.response?.status === 401) {
            get().logout();
          }
        }
      },

      // ========== 登出 ==========
      logout: () => {
        tokenManager.clear();
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
          needsVerification: false, // ✅ 清除郵箱驗證標記
          lastRefreshTime: null,
          pendingEmail: null, // ✅ 清除待驗證郵箱
        });
        logger.info('AUTH', 'Logout successful');
      },

      // ========== 檢查認證狀態 ==========
      checkAuth: async () => {
        const token = tokenManager.getAccessToken();
        const refreshToken = tokenManager.getRefreshToken();

        if (!token || !refreshToken) {
          set({ isAuthenticated: false });
          return;
        }

        set({ token, refreshToken });

        try {
          await get().fetchMe();
          logger.info('AUTH', 'Authentication check passed');
        } catch {
          get().logout();
          logger.warn('AUTH', 'Authentication check failed');
        }
      },
    }),
    {
      name: 'fitbuddy-auth-store',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        // 驗證並保留原始的 login 函數引用
        if (state) {
          const originalLogin = state.login;
          if (typeof originalLogin === 'function') {
            // 創建包裝函數確保正確的執行上下文
            state.login = async (email: string, password: string) => {
              console.log('[login wrapper] Calling with email type:', typeof email, 'password type:', typeof password);
              console.log('[login wrapper] Email value:', email);
              console.log('[login wrapper] Password value length:', password?.length || 0);
              // 使用 call 確保正確的 this 上下文
              return originalLogin.call(state, email, password);
            };
            console.log('[Zustand] Rehydrated state - login function wrapped');
          } else {
            console.warn('[Zustand] Rehydrated state - login is not a function:', typeof originalLogin);
          }
        }
      },
    }
  )
);

export default useAuthStore;

