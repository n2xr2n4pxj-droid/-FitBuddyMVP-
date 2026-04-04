/**
 * FitBuddy 認證相關路由配置
 * 
 * 使用 wouter 進行路由配置（項目實際使用 wouter 而非 react-router-dom）
 * - 包含公開路由和保護路由
 * - 自動重定向邏輯
 * - 與 React Query + Axios 統一方案集成
 * 
 * 注意：如需使用 React Router v6，請先安裝：
 * npm install react-router-dom
 * 然後將此文件中的 wouter 相關代碼替換為 react-router-dom
 */

import { useEffect } from 'react';
import { useLocation, Switch, Route } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import LandingPage from '@/pages/auth/LandingPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterFlow from '@/pages/auth/RegisterFlow/RegisterFlow';
import Dashboard from '@/pages/dashboard';

// ========== 保護路由組件 ==========

/**
 * 保護路由組件
 * 已登入用戶可以訪問，未登入用戶重定向到 /login
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // useEffect 會處理重定向
  }

  return <>{children}</>;
}

/**
 * 公開路由組件
 * 未登入用戶可以訪問，已登入用戶重定向到 /dashboard
 */
interface PublicRouteProps {
  children: React.ReactNode;
}

function PublicRoute({ children }: PublicRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // useEffect 會處理重定向
  }

  return <>{children}</>;
}

function NotFoundRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation('/', { replace: true });
  }, [setLocation]);

  return null;
}

// ========== 路由配置組件 ==========

/**
 * 認證相關路由配置
 * 
 * 路由邏輯：
 * - 已登入用戶訪問 /login → 重定向到 /dashboard
 * - 已登入用戶訪問 /register → 重定向到 /dashboard
 * - 未登入用戶訪問 /dashboard → 重定向到 /login
 * - 訪問不存在的路由 → 重定向到首頁
 */
export default function AuthRoutes() {
  return (
    <Switch>
      {/* 首頁 */}
      <Route path="/" component={LandingPage} />

      {/* 公開路由 - 未登入用戶 */}
      <Route path="/login">
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      </Route>

      <Route path="/register">
        <PublicRoute>
          <RegisterFlow />
        </PublicRoute>
      </Route>

      {/* 保護路由 - 需要登入 */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      {/* 404 頁面 - 重定向到首頁 */}
      <Route component={NotFoundRedirect} />
    </Switch>
  );
}
