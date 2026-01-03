import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import type { UserRole } from '@/types/auth';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
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

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
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

  // ✅ 檢查角色權限（處理大小寫不匹配）
  const userRoleStr = String(user.role || '').toUpperCase();
  const normalizedUserRole = userRoleStr as UserRole;
  
  // 將 requiredRoles 也轉換為大寫進行比較
  const normalizedRequiredRoles = requiredRoles?.map(role => String(role).toUpperCase() as UserRole) || [];
  const isAuthorized = !requiredRoles || requiredRoles.length === 0 || normalizedRequiredRoles.includes(normalizedUserRole);

  if (!isAuthorized) {
    return fallback || (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>訪問被拒絕</h2>
          <p>你沒有權限訪問此頁面。</p>
          <p>你的角色: {normalizedUserRole}</p>
          {requiredRoles && <p>需要的角色: {requiredRoles.join(', ')}</p>}
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
        const token = localStorage.getItem('authToken');
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error('Failed');

        const userData = await response.json();
        const normalizedRole = normalizeRole(userData.role || 'USER');
        
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

