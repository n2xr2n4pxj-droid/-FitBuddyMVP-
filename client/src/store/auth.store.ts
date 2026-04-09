import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '@/services/authService';
import { StoreUser } from '@/types/user';

/**
 * 認證狀態介面
 */
interface AuthState {
  token: string | null;
  user: StoreUser | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  // compatibility
  isLoading: boolean;
  error: string | null;
  needsVerification: boolean;
  registrationComplete: boolean;
  nextStep: number | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  selectRole: (role: 'client' | 'coach' | 'admin' | 'both') => Promise<void>;
  loginWithOAuth: (oauthToken: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  logout: () => void;
}

/**
 * 【核心守衛】嚴格型別驗證 (Type Guard)
 * 確保所有從 API 或 LocalStorage 取得的資料都符合 StoreUser 規範
 */
const validateUserData = (userData: any): userData is StoreUser => {
  return (
    userData !== null &&
    typeof userData === 'object' &&
    typeof userData.id === 'string' &&
    typeof userData.email === 'string' &&
    typeof userData.registrationComplete === 'boolean' &&
    Array.isArray(userData.roles) // ✅ 關鍵修正：確保 roles 為陣列，防止 .includes() 崩潰
  );
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      /**
       * 【私有方法】處理教練邀請碼的重試與清理 (Closure Scope)
       */
      const _handleCoachRefSequence = async () => {
        const pendingRef = localStorage.getItem('pendingCoachRef');
        if (!pendingRef) return;

        const MAX_RETRIES = 3;
        const rawRetryCount = Number(localStorage.getItem('coachRefRetryCount'));
        const retryCount = Number.isFinite(rawRetryCount) ? rawRetryCount : 0;

        try {
          await authService.applyCoachRef(pendingRef);
          localStorage.removeItem('pendingCoachRef');
          localStorage.removeItem('coachRefRetryCount');
          console.log('[AuthStore] Coach ref applied successfully.');
        } catch (error) {
          const newCount = retryCount + 1;
          if (newCount >= MAX_RETRIES) {
            console.error('[AuthStore] Max retries reached for Coach Ref. Cleaning up zombie state.');
            localStorage.removeItem('pendingCoachRef');
            localStorage.removeItem('coachRefRetryCount');
          } else {
            localStorage.setItem('coachRefRetryCount', String(newCount));
            console.warn(`[AuthStore] Coach ref failed. Retry attempt: ${newCount}`);
          }
        }
      };

      /**
       * 【私有方法】統一處理認證成功後的狀態寫入 (DRY Optimization)
       */
      const _applyAuthResult = async (token: string, userData: any) => {
        if (!validateUserData(userData)) {
          throw new Error('INVALID_USER_DATA');
        }

        set({
          token,
          user: userData as StoreUser,
          isAuthenticated: true,
          registrationComplete: userData.registrationComplete,
        });

        // 執行原子化副作用
        try { await _handleCoachRefSequence(); } catch (e) { console.warn("[AuthStore] Coach ref sequence failed silently."); }
      };

      return {
        token: null,
        user: null,
        isAuthenticated: false,
        isAuthLoading: false,
        isLoading: false,
        error: null,
        needsVerification: false,
        registrationComplete: false,
        nextStep: null,

        /**
         * 標準 Email/Password 登入流
         */
        login: async (email, password) => {
          set({ isAuthLoading: true, isLoading: true, error: null, needsVerification: false });
          try {
            const res = await authService.login({ email, password });
            const token = res.token ?? res.data?.token;
            const rawUser = res.user ?? res.data?.user;
            const normalizedUser: StoreUser | null = rawUser
              ? {
                  id: rawUser.id,
                  email: rawUser.email,
                  roles: [String(rawUser.role ?? 'client').toLowerCase()],
                  role: String(rawUser.role ?? 'client').toLowerCase(),
                  registrationComplete: (rawUser as any).registrationComplete === true,
                  name:
                    `${rawUser.firstName ?? ''} ${rawUser.lastName ?? ''}`.trim() || rawUser.email,
                  firstName: rawUser.firstName ?? null,
                  lastName: rawUser.lastName ?? null,
                  avatar: rawUser.avatar ?? null,
                }
              : null;
            if (!token || !normalizedUser) throw new Error('INVALID_USER_DATA');
            await _applyAuthResult(token, normalizedUser);
          } catch (error) {
            set({ token: null, user: null, isAuthenticated: false, registrationComplete: false });
            throw error;
          } finally {
            set({ isAuthLoading: false, isLoading: false });
          }
        },

        /**
         * OAuth 登入流
         */
        loginWithOAuth: async (oauthToken) => {
          set({ isAuthLoading: true, isLoading: true, error: null });
          try {
            const maybeLoginWithGoogle = (authService as any).loginWithGoogle;
            if (typeof maybeLoginWithGoogle !== 'function') {
              throw new Error('OAUTH_LOGIN_NOT_IMPLEMENTED');
            }
            const res = await maybeLoginWithGoogle(oauthToken);
            const token = res?.token ?? res?.data?.token;
            const rawUser = res?.user ?? res?.data?.user;
            const normalizedUser: StoreUser | null = rawUser
              ? {
                  id: rawUser.id,
                  email: rawUser.email,
                  roles: [String(rawUser.role ?? 'client').toLowerCase()],
                  role: String(rawUser.role ?? 'client').toLowerCase(),
                  registrationComplete: false,
                  name:
                    `${rawUser.firstName ?? ''} ${rawUser.lastName ?? ''}`.trim() || rawUser.email,
                  firstName: rawUser.firstName ?? null,
                  lastName: rawUser.lastName ?? null,
                  avatar: rawUser.avatar ?? null,
                }
              : null;
            if (!token || !normalizedUser) throw new Error('INVALID_USER_DATA');
            await _applyAuthResult(token, normalizedUser);
          } catch (error) {
            set({ token: null, user: null, isAuthenticated: false, registrationComplete: false });
            throw error;
          } finally {
            set({ isAuthLoading: false, isLoading: false });
          }
        },

        register: async (email, password, firstName, lastName) => {
          set({ isAuthLoading: true, isLoading: true, error: null, needsVerification: false });
          try {
            await authService.register({ email, password, firstName, lastName });
            set({
              token: null,
              user: null,
              isAuthenticated: false,
              registrationComplete: false,
              needsVerification: true,
            });
          } catch (error: any) {
            set({
              token: null,
              user: null,
              isAuthenticated: false,
              registrationComplete: false,
              error: error?.response?.data?.error || error?.message || 'Registration failed',
            });
            throw error;
          } finally {
            set({ isAuthLoading: false, isLoading: false });
          }
        },

        selectRole: async (role) => {
          set({ isAuthLoading: true, isLoading: true, error: null });
          try {
            const res = await authService.selectRole(role === 'both' ? 'coach' : role);
            const token = res.token ?? res.data?.token ?? get().token;
            const rawUser = res.user ?? res.data?.user;
            const normalizedUser: StoreUser | null = rawUser
              ? {
                  id: rawUser.id,
                  email: rawUser.email,
                  roles: [String(rawUser.role ?? role).toLowerCase()],
                  role: String(rawUser.role ?? role).toLowerCase(),
                  registrationComplete: true,
                  name:
                    `${rawUser.firstName ?? ''} ${rawUser.lastName ?? ''}`.trim() || rawUser.email,
                  firstName: rawUser.firstName ?? null,
                  lastName: rawUser.lastName ?? null,
                  avatar: rawUser.avatar ?? null,
                }
              : null;
            if (!token || !normalizedUser) throw new Error('INVALID_USER_DATA');
            await _applyAuthResult(token, normalizedUser);
          } catch (error: any) {
            set({ error: error?.response?.data?.error || error?.message || 'Role selection failed' });
            throw error;
          } finally {
            set({ isAuthLoading: false, isLoading: false });
          }
        },

        /**
         * 初始化狀態同步 (用於頁面重新整理)
         */
        fetchMe: async () => {
          const token = get().token;
          if (!token) return;

          try {
            const me = await authService.getMe();
            const userData: StoreUser = {
              id: me.id,
              email: me.email,
              roles: [String(me.role ?? 'client').toLowerCase()],
              role: String(me.role ?? 'client').toLowerCase(),
              registrationComplete: me.registrationComplete === true,
              name: `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim() || me.email,
              firstName: me.firstName ?? null,
              lastName: me.lastName ?? null,
              avatar: me.avatar ?? null,
            };

            // 使用統一的守衛標準，確保從 API 拿到的資料也是乾淨的
            if (!validateUserData(userData)) {
              console.error('[AuthStore] fetchMe: Data corruption detected. Forcing logout.');
              get().logout();
              return;
            }

            set({
              user: userData as StoreUser,
              isAuthenticated: true,
              registrationComplete: userData.registrationComplete,
              nextStep: typeof me.nextStep === 'number' ? me.nextStep : null,
            });
          } catch (error) {
            console.error('[AuthStore] fetchMe failed:', error);
            get().logout();
          }
        },

        initializeAuth: async () => {
          set({ isAuthLoading: true, isLoading: true });
          try {
            await get().fetchMe();
          } finally {
            set({ isAuthLoading: false, isLoading: false });
          }
        },

        /**
         * 徹底登出
         */
        logout: () => {
          set({ 
            token: null, 
            user: null, 
            isAuthenticated: false, 
            registrationComplete: false,
            nextStep: null,
            error: null,
            needsVerification: false,
          });
          localStorage.removeItem('pendingCoachRef');
          localStorage.removeItem('coachRefRetryCount');
        },
      };
    },
    {
      name: 'fitbuddy-auth-store',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        registrationComplete: state.registrationComplete,
      }),
    }
  )
);

export default useAuthStore;
