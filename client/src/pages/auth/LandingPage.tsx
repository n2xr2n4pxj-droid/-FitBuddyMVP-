/**
 * FitBuddy 首頁/歡迎頁面
 *
 * 使用 React + TypeScript + Tailwind CSS
 * 使用 wouter 進行路由導航（專案使用 wouter 而非 react-router-dom）
 */

import React from 'react';
import { useLocation } from 'wouter';

export default function LandingPage(): JSX.Element {
  const [, setLocation] = useLocation();

  const handleLogin = (): void => {
    setLocation('/login');
  };

  const handleRegister = (): void => {
    setLocation('/register-flow');
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center relative overflow-hidden bg-neutral-950 px-4">
      {/* 全螢幕背景光暈 */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      {/* 置中的核心玻璃卡片 */}
      <div className="relative z-10 w-full max-w-xl bg-neutral-900/50 backdrop-blur-xl border border-white/10 px-8 py-16 sm:px-12 sm:py-20 rounded-3xl shadow-2xl flex flex-col items-center text-center">
        <h1 className="text-5xl font-black tracking-tighter text-white mb-5">
          FitBuddy
        </h1>
        <p className="mb-12 text-lg font-normal leading-relaxed text-neutral-400">
          你的專屬雙軸問責教練。今日嘅訓練，準備好未？
        </p>

        <div className="w-full max-w-xs sm:max-w-sm flex flex-col gap-4 mt-8">
          <button
            type="button"
            onClick={handleRegister}
            className="w-full rounded-xl bg-blue-600 py-[18px] font-bold text-white shadow-[0_4px_20px_rgba(37,99,235,0.4)] transition-all hover:scale-[1.02] hover:bg-blue-500 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            aria-label="免費註冊，開始旅程"
            data-testid="button-register"
          >
            免費註冊 / 開始旅程
          </button>
          <button
            type="button"
            onClick={handleLogin}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 py-4.5 font-medium text-neutral-200 transition-all hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            aria-label="已有帳戶，立即登入"
            data-testid="button-login"
          >
            已有帳戶？立即登入
          </button>
        </div>

        <p className="mt-10 text-center text-xs text-neutral-600">
          © {new Date().getFullYear()} FitBuddy
        </p>
      </div>
    </div>
  );
}
