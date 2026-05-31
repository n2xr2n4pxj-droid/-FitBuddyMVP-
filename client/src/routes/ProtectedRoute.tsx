import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import type { UserRole } from '@/types/auth';
import { normalizeRole, isCoach, isClient, isAdmin } from '@/types/auth';
import { useAuth } from '@/hooks/useAuth';
import { tokenManager } from '@/lib/api-client';

/** `coach` / `client` 為簡寫；其餘傳入則視為 `UserRole`。 */
export type ProtectedRouteRole = 'coach' | 'client' | UserRole;

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** 單一角色簡寫（例如 `coach`）；若同時傳 `requiredRoles`，以此為準。 */
  role?: ProtectedRouteRole;
  requiredRoles?: UserRole[];
  fallback?: React.ReactNode;
}

export interface UserData {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  avatar?: string;
  firstName?: string;
  lastName?: string;
}

function resolveRequiredRoles(
  role: ProtectedRouteRole | undefined,
  requiredRoles: UserRole[] | undefined,
): UserRole[] | undefined {
  if (role !== undefined) {
    const key = String(role).toLowerCase();
    if (key === 'coach') return ['COACH'];
    if (key === 'client') return ['USER'];
    return [String(role).toUpperCase() as UserRole];
  }
  return requiredRoles;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  role,
  requiredRoles,
  fallback,
}) => {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();

  // ✅ 使用 wouter 的重定向方式
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>加載中...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null; // useEffect 會處理重定向
  }

  const effectiveRequiredRoles = resolveRequiredRoles(role, requiredRoles);

  // ✅ 檢查角色權限（處理大小寫不匹配）
  const userRoleStr = String(user.role || '').toUpperCase();
  const normalizedUserRole = userRoleStr as UserRole;
  
  // 將 requiredRoles 也轉換為大寫進行比較
  const normalizedRequiredRoles = effectiveRequiredRoles?.map((r) => String(r).toUpperCase() as UserRole) || [];
  const isAuthorized = !effectiveRequiredRoles || effectiveRequiredRoles.length === 0 || normalizedRequiredRoles.includes(normalizedUserRole);

  if (!isAuthorized) {
    return fallback || (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>訪問被拒絕</h2>
          <p>你沒有權限訪問此頁面。</p>
          <p>你的角色: {normalizedUserRole}</p>
          {effectiveRequiredRoles && <p>需要的角色: {effectiveRequiredRoles.join(', ')}</p>}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;

// Hooks
export const useCurrentUser = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = tokenManager.getAccessToken();
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        });

        if (!response.ok) throw new Error('Failed');

        const userData = await response.json();
        const normalizedRole = normalizeRole(userData.role || 'USER') as UserRole;
        
        setUser({
          ...userData,
          role: normalizedRole,
        });
      } catch (error) {
        console.error('[useCurrentUser]:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return { user, loading };
};

export const useIsCoach = () => {
  const { user } = useCurrentUser();
  return user ? isCoach(user) : false;
};

export const useIsClient = () => {
  const { user } = useCurrentUser();
  return user ? isClient(user) : false;
};

export const useIsAdmin = () => {
  const { user } = useCurrentUser();
  return user ? isAdmin(user) : false;
};

export const useHasRole = (roles: UserRole[]) => {
  const { user } = useCurrentUser();
  return user ? roles.includes(user.role) : false;
};

