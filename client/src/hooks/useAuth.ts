import { useAuthStore } from '@/store/auth.store';
import { logger } from '@/lib/logger';

/**
 * 企業級 Auth Hook
 * 包含角色檢查、日誌追蹤和離線支持
 */
export const useAuth = () => {
  const {
    user,
    token,
    refreshToken,
    isAuthenticated,
    isLoading,
    error,
    needsVerification, // ✅ 添加 needsVerification
    login,
    register,
    selectRole,
    logout,
    fetchMe,
    checkAuth,
  } = useAuthStore();

  // 角色檢查便利方法
  const isClient = user?.role === 'client';
  const isCoach = user?.role === 'coach' || user?.role === 'both';
  const isAdmin = user?.role === 'admin';

  // ✨ 企業級：離線支持 - 檢查是否有有效的本地 token
  const isOfflineMode = isAuthenticated && typeof navigator !== 'undefined' && !navigator.onLine;

  return {
    // 狀態
    user,
    token,
    refreshToken,
    isAuthenticated,
    isLoading,
    error,
    needsVerification, // ✅ 添加 needsVerification

    // 角色檢查
    isClient,
    isCoach,
    isAdmin,

    // ✨ 企業級：離線模式
    isOfflineMode,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

    // 操作
    login,
    register,
    selectRole,
    logout,
    fetchMe,
    checkAuth,

    // ✨ 企業級：日誌操作
    logAction: (action: string, data?: any) => {
      logger.info('USER_ACTION', action, {
        userId: user?.id,
        ...data,
      });
    },
  };
};
