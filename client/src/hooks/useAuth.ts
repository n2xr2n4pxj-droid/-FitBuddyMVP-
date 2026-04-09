import { useAuthStore } from '@/store/auth.store';

export const useAuth = () => {
  const store = useAuthStore();
  const primaryRole = (store.user?.roles?.[0] ?? 'client').toLowerCase();
  const normalizedRole = primaryRole === 'coach' || primaryRole === 'both' ? 'COACH' : 'USER';
  const userForLegacy = store.user
    ? {
        ...store.user,
        role: normalizedRole as 'USER' | 'COACH',
      }
    : null;

  return {
    token: store.token,
    user: userForLegacy,
    isAuthenticated: store.isAuthenticated,
    isLoggedIn: store.isAuthenticated,
    isAuthLoading: store.isAuthLoading,
    registrationComplete: store.registrationComplete,
    error: store.error,
    needsVerification: store.needsVerification,

    // Compatibility Layer
    isLoading: store.isAuthLoading,
    role: normalizedRole,
    register: store.register,
    selectRole: store.selectRole,
    initializeAuth: store.initializeAuth,

    hasRole: (role: string) => store.user?.roles?.includes(role) ?? false,

    login: store.login,
    loginWithOAuth: store.loginWithOAuth,
    logout: store.logout,
    fetchMe: store.fetchMe,
  };
};
