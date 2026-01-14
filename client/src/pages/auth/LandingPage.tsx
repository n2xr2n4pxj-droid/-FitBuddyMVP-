/**
 * FitBuddy 首頁/歡迎頁面
 * 
 * 生產級別的歡迎頁面組件
 * - 使用 React + TypeScript + Tailwind CSS
 * - 使用 wouter 進行路由導航（項目使用 wouter 而非 react-router-dom）
 * - 行動裝置響應式設計
 * - 深色主題背景
 */

import React from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * LandingPage 組件
 * FitBuddy 應用的歡迎/登入頁面
 */
export default function LandingPage(): JSX.Element {
  // 使用 wouter 的 useLocation hook（項目實際使用 wouter 而非 react-router-dom）
  // 如果需要 react-router-dom 的 useNavigate，需要先安裝和配置 react-router-dom
  const [, setLocation] = useLocation();

  /**
   * 處理返回按鈕點擊
   * 返回應用首頁
   */
  const handleBack = (): void => {
    setLocation('/');
  };

  /**
   * 處理登入按鈕點擊
   * 導航到登入頁面
   */
  const handleLogin = (): void => {
    setLocation('/login');
  };

  /**
   * 處理註冊按鈕點擊
   * 導航到註冊頁面
   */
  const handleRegister = (): void => {
    setLocation('/register-flow');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between relative overflow-hidden">
      {/* 背景裝飾（可選） */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-600 rounded-full blur-3xl"></div>
      </div>

      {/* 頂部返回按鈕 */}
      <div className="w-full pt-6 pb-4 px-4 flex items-center z-10 relative">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 rounded-md px-2 py-1"
          aria-label="返回首頁"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">返回首頁</span>
        </button>
      </div>

      {/* 主要內容區域 */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4 pt-40 pb-32 z-10 relative space-y-6">
        {/* Logo 和應用名稱 */}
        <div className="flex flex-col items-center gap-6 mb-16">
          {/* Logo */}
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full"></div>
            <h1 className="text-3xl font-bold text-emerald-500 relative z-10 tracking-tight">
              FitBuddy
            </h1>
          </div>

          {/* 標語 */}
          <p className="text-lg text-gray-400 text-center max-w-md px-4">
            開始你的健身之旅，記錄每一餐，追蹤每一次訓練
          </p>
        </div>

        {/* 按鈕組 */}
        <div className="flex flex-col items-center gap-4 w-full max-w-md px-4">
          {/* 登入按鈕 */}
          <Button
            onClick={handleLogin}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-3 text-base rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 shadow-lg hover:shadow-emerald-500/50 active:scale-[0.98]"
            aria-label="已有帳號？登入"
            data-testid="button-login"
          >
            已有帳號？登入
          </Button>

          {/* 註冊按鈕 */}
          <Button
            onClick={handleRegister}
            variant="outline"
            className="w-full border-2 border-gray-700 hover:border-white/40 bg-transparent hover:bg-white/5 text-white font-semibold px-4 py-3 text-base rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-[0.98]"
            aria-label="新用戶？免費註冊"
            data-testid="button-register"
          >
            新用戶？免費註冊
          </Button>
        </div>
      </div>

      {/* 底部裝飾（可選） */}
      <div className="w-full pb-8 px-4 flex items-center justify-center z-10 relative">
        <p className="text-white/50 text-xs text-center">
          © 2024 FitBuddy. 追蹤你的健身旅程
        </p>
      </div>
    </div>
  );
}
