/**
 * FitBuddy 認證相關路由配置 (React Router v6 版本)
 * 
 * 使用 React Router v6 進行路由配置
 * - 包含公開路由和保護路由
 * - 自動重定向邏輯
 * - 與 React Query + Axios 統一方案集成
 * 
 * 使用方法：
 * 1. 安裝依賴: npm install react-router-dom
 * 2. 在 App.tsx 中導入此文件並替換現有路由
 * 3. 將 <BrowserRouter> 包裹在 App 組件中
 * 
 * 注意：項目目前使用 wouter，如需遷移到 React Router v6，
 * 請參考此文件的實現方式
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
    return <Navigate to="/login" replace />;
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
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// ========== 路由配置組件 ==========

/**
 * 認證相關路由配置 (React Router v6)
 * 
 * 路由邏輯：
 * - 已登入用戶訪問 /login → 重定向到 /dashboard
 * - 已登入用戶訪問 /register → 重定向到 /dashboard
 * - 未登入用戶訪問 /dashboard → 重定向到 /login
 * - 訪問不存在的路由 → 重定向到首頁
 */
export default function AuthRoutesReactRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 首頁 */}
        <Route path="/" element={<LandingPage />} />

        {/* 公開路由 - 未登入用戶 */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterFlow />
            </PublicRoute>
          }
        />

        {/* 保護路由 - 需要登入 */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* 404 頁面 - 重定向到首頁 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * App 組件示例 (React Router v6)
 * 
 * 在 App.tsx 中使用：
 * 
 * import { QueryClientProvider } from '@tanstack/react-query';
 * import { queryClient } from '@/lib/queryClient';
 * import AuthRoutesReactRouter from '@/routes/AuthRoutesReactRouter';
 * 
 * function App() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <AuthRoutesReactRouter />
 *     </QueryClientProvider>
 *   );
 * }
 * 
 * export default App;
 */
