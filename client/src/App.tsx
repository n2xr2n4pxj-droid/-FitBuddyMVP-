import { useEffect, useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { offlineManager } from "@/lib/offline-manager";
import ProtectedRoute from "@/routes/ProtectedRoute";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import TDEECalculator from "@/components/tdee-calculator";
import AuthPage from "@/pages/auth";
import AuthLoginPage from "@/pages/auth-login";
// import AuthRegisterPage from "@/pages/auth-register"; // ✅ 已替換為 RegisterFlow（新版本 7 步流程）
import RegisterFlow from "@/pages/auth/RegisterFlow/RegisterFlow";
import Profile from "@/pages/profile";
import History from "@/pages/history";
import Trends from "@/pages/trends";
import RoleSelection from "@/pages/RoleSelection";
import CoachDashboard from "@/pages/CoachDashboard";
import ClientDashboard from "@/pages/ClientDashboard";
import AcceptInvitation from "@/pages/AcceptInvitation";
import SendInvitation from "@/pages/SendInvitation";
import VerifyEmail from "@/pages/VerifyEmail";
import ResendVerification from "@/pages/ResendVerification";
import VerifyEmailPrompt from "@/pages/VerifyEmailPrompt";
import Unauthorized from "@/pages/unauthorized";
import Layout from "@/components/layout";
import type { UserRole } from "@/types/auth";
import { normalizeRole } from "@/types/auth";

function Router() {
  const { user, isAuthenticated, isLoading, checkAuth, isOnline } = useAuth();
  const [queueSize, setQueueSize] = useState(0);

  // ✨ 企業級：應用啟動時檢查認證狀態
  useEffect(() => {
    logger.info('APP', 'Application started', {
      timestamp: new Date().toISOString(),
      isOnline,
    });
    checkAuth();
  }, [checkAuth]);

  // 🔍 調試：記錄路由匹配信息
  useEffect(() => {
    console.log("🔍 [App.tsx Router] 路由狀態更新");
    console.log("📧 當前路徑:", window.location.pathname);
    console.log("📧 認證狀態: isAuthenticated =", isAuthenticated);
    console.log("📧 加載狀態: isLoading =", isLoading);
    console.log("📧 用戶角色: role =", user?.role);
  }, [isAuthenticated, isLoading, user?.role]);

  // ✨ 企業級：監聽網絡狀態和隊列變化
  useEffect(() => {
    const updateQueueSize = () => {
      setQueueSize(offlineManager.getQueueSize());
    };

    // 初始更新
    updateQueueSize();

    // 監聽網絡狀態變化
    const handleOnline = () => {
      logger.info('APP', 'Network status changed', { isOnline: true });
      updateQueueSize();
    };

    const handleOffline = () => {
      logger.info('APP', 'Network status changed', { isOnline: false });
      updateQueueSize();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 定期更新隊列大小（當離線時）
    const interval = setInterval(updateQueueSize, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOnline]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
          {!isOnline && (
            <p className="text-yellow-600 text-sm mt-2">離線模式</p>
          )}
        </div>
      </div>
    );
  }

  // 未認證用戶路由
  if (!isAuthenticated) {
    console.log("🔍 [App.tsx] 渲染未認證用戶路由區域");
    console.log("📧 路由列表包含: /verify-email-prompt");

    return (
      <>
        {/* ✨ 企業級：離線指示器 */}
        {!isOnline && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 fixed top-0 left-0 right-0 z-50">
            <div className="container mx-auto">
              <p className="font-bold">離線模式</p>
              <p className="text-sm">您當前離線。某些功能可能不可用。</p>
              {queueSize > 0 && (
                <p className="text-sm">隊列中有 {queueSize} 個待處理請求。</p>
              )}
            </div>
          </div>
        )}
        <div className={!isOnline ? 'pt-20' : ''}>
          <Switch>
        {/* 更具體的路由應該放在前面 */}
        <Route path="/auth/accept-invitation/:code" component={AcceptInvitation} />
        <Route path="/auth/verify-email/:token" component={VerifyEmail} />
        <Route path="/verify-email/:token" component={VerifyEmail} />
        <Route path="/verify-email-prompt" component={VerifyEmailPrompt} />
        {/* ✅ 註冊流程（統一使用 RegisterFlow - 新版本 7 步流程） */}
        <Route path="/register" component={RegisterFlow} />
        <Route path="/register-flow" component={RegisterFlow} />
        <Route path="/auth/register" component={RegisterFlow} />
        <Route path="/auth/login" component={AuthLoginPage} />
        <Route path="/login" component={AuthLoginPage} />
        <Route path="/resend-verification" component={ResendVerification} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/" component={Landing} />
        <Route component={NotFound} />
          </Switch>
        </div>
      </>
    );
  }

  // ✅ 已認證但郵箱未驗證 → 強制導向驗證頁面
  if (isAuthenticated && user && user.emailVerified === false) {
    logger.info('APP', 'User authenticated but email not verified. Redirecting to verification.');
    console.log("🔍 [App.tsx] 用戶已認證但郵箱未驗證，重定向到驗證頁面");
    
    // 重定向到驗證提示頁面
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/verify-email')) {
      window.location.href = `/verify-email-prompt?email=${encodeURIComponent(user.email)}`;
      return null;
    }
  }

  // ✅ 已認證但未選擇角色 → 強制導向角色選擇頁面
  if (isAuthenticated && !user?.role) {
    logger.info('APP', 'User authenticated but no role selected. Redirecting to role selection.');
    console.log("🔍 [App.tsx] 渲染已認證但未選擇角色路由區域");
    console.log("📧 路由列表包含: /verify-email-prompt (已添加)");

    return (
      <>
        {/* ✨ 企業級：離線指示器 */}
        {!isOnline && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 fixed top-0 left-0 right-0 z-50">
            <div className="container mx-auto">
              <p className="font-bold">離線模式</p>
              <p className="text-sm">您當前離線。某些功能可能不可用。</p>
              {queueSize > 0 && (
                <p className="text-sm">隊列中有 {queueSize} 個待處理請求。</p>
              )}
            </div>
          </div>
        )}
        <div className={!isOnline ? 'pt-20' : ''}>
          <Layout>
            <Switch>
          {/* ✅ 郵箱驗證相關路由（優先匹配，允許未驗證用戶完成驗證流程） */}
          <Route path="/auth/verify-email/:token" component={VerifyEmail} />
          <Route path="/verify-email/:token" component={VerifyEmail} />
          <Route path="/verify-email-prompt" component={VerifyEmailPrompt} />
          <Route path="/resend-verification" component={ResendVerification} />
          
          {/* 允許在選角色時訪問邀請接受頁面 */}
          <Route path="/auth/accept-invitation/:code" component={AcceptInvitation} />
          {/* 只能訪問角色選擇頁面 */}
          <Route path="/role-selection" component={RoleSelection} />
          {/* 其他所有路由都重定向到 /role-selection */}
          <Route component={() => {
            window.location.replace('/role-selection');
            return null;
          }} />
            </Switch>
          </Layout>
        </div>
      </>
    );
  }

  // ✅ 已認證且已選擇角色 → 正常路由
  logger.info('APP', 'Authenticated user with role', { role: user?.role });
  console.log("🔍 [App.tsx] 渲染已認證用戶路由區域");
  console.log("📧 路由列表包含: /verify-email-prompt (已添加)");

  return (
    <>
      {/* ✨ 企業級：離線指示器 */}
      {!isOnline && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 fixed top-0 left-0 right-0 z-50">
          <div className="container mx-auto">
            <p className="font-bold">離線模式</p>
            <p className="text-sm">您當前離線。某些功能可能不可用。</p>
            {queueSize > 0 && (
              <p className="text-sm">隊列中有 {queueSize} 個待處理請求。</p>
            )}
          </div>
        </div>
      )}
      <div className={!isOnline ? 'pt-20' : ''}>
        <Layout>
          <Switch>
        {/* ✅ 郵箱驗證相關路由（放在最前面，優先匹配）
            即使已認證，用戶仍需要完成郵箱驗證流程 */}
        <Route path="/auth/verify-email/:token" component={VerifyEmail} />
        <Route path="/verify-email/:token" component={VerifyEmail} />
        <Route path="/verify-email-prompt" component={VerifyEmailPrompt} />
        <Route path="/resend-verification" component={ResendVerification} />
        
        {/* 邀請接受頁面 */}
        <Route path="/auth/accept-invitation/:code" component={AcceptInvitation} />
        
        {/* ✅ 註冊流程（已認證用戶可以繼續完成註冊） */}
        <Route path="/register" component={RegisterFlow} />
        <Route path="/register-flow" component={RegisterFlow} />
        
        {/* 角色選擇頁面（通常不會再訪問，但保留以防萬一） */}
        <Route path="/role-selection" component={RoleSelection} />
        
        {/* 教練儀表板（受保護） */}
        <Route
          path="/coach-dashboard"
          component={() => (
            <ProtectedRoute requiredRoles={['COACH', 'BOTH'] as UserRole[]}>
              <CoachDashboard />
            </ProtectedRoute>
          )}
        />
        
        {/* 發送邀請頁面（受保護，僅教練） */}
        <Route
          path="/send-invitation"
          component={() => (
            <ProtectedRoute requiredRoles={['COACH', 'BOTH'] as UserRole[]}>
              <SendInvitation />
            </ProtectedRoute>
          )}
        />
        
        {/* 客戶儀表板（受保護） */}
        <Route
          path="/client-dashboard"
          component={() => (
            <ProtectedRoute requiredRoles={['USER', 'BOTH'] as UserRole[]}>
              <ClientDashboard />
            </ProtectedRoute>
          )}
        />
        
        {/* 其他頁面 */}
        <Route path="/unauthorized" component={Unauthorized} />
        <Route path="/tdee" component={TDEECalculator} />
        <Route path="/profile" component={Profile} />
        <Route path="/history" component={History} />
        <Route path="/trends" component={Trends} />
        <Route path="/" component={Dashboard} />
        <Route component={NotFound} />
          </Switch>
        </Layout>
      </div>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
