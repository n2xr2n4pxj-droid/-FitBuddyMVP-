import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/auth';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: Array<UserRole | 'client' | 'coach' | 'admin' | 'both'>;
}

export const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const normalizedAllowed = allowedRoles.map((role) => {
    const upper = String(role).toUpperCase();
    if (upper === 'CLIENT') return 'USER';
    if (upper === 'BOTH') return 'COACH';
    return upper as UserRole;
  });

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setLocation('/login');
        return;
      }

      if (user && !normalizedAllowed.includes(user.role)) {
        setLocation('/unauthorized');
        return;
      }
    }
  }, [isAuthenticated, user, isLoading, normalizedAllowed, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">加載中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // useEffect 會處理重定向
  }

  if (user && !normalizedAllowed.includes(user.role)) {
    return null; // useEffect 會處理重定向
  }

  return <>{children}</>;
};

