/**
 * FitBuddy 登入頁面組件
 * 
 * 生產級別的登入頁面
 * - 使用 React + TypeScript + Tailwind CSS + React Hook Form
 * - 使用 React Query + Axios 統一架構
 * - 行動裝置響應式設計
 * - 深色主題背景
 * 
 * 注意：項目使用 wouter 而非 react-router-dom
 * 如需使用 react-router-dom，請先安裝並配置：npm install react-router-dom
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter'; // 項目使用 wouter 而非 react-router-dom
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useLogin } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import GoogleLoginButton from '@/components/GoogleLoginButton';
import { useToast } from '@/hooks/use-toast';

// ========== 表單驗證 Schema ==========

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email 為必填項')
    .email('請輸入有效的 Email 格式'),
  password: z
    .string()
    .min(1, '密碼為必填項')
    .min(6, '密碼至少需要 6 個字符'),
  rememberMe: z.boolean().optional().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ========== LoginPage 組件 ==========

export default function LoginPage(): JSX.Element {
  // 使用 wouter 的 useLocation hook（項目實際使用 wouter 而非 react-router-dom）
  // 如果需要 react-router-dom 的 useNavigate，請先安裝並配置 react-router-dom
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // React Hook Form
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  // Watch rememberMe for checkbox
  const rememberMe = watch('rememberMe');

  // React Query mutation
  const loginMutation = useLogin();
  const { mutate: login, isPending, error } = loginMutation;

  /**
   * 處理返回按鈕點擊
   * 返回歡迎頁面
   */
  const handleBack = (): void => {
    setLocation('/');
  };

  /**
   * 處理表單提交
   */
  const onSubmit = (data: LoginFormData): void => {
    login(
      {
        email: data.email.trim(),
        password: data.password,
      },
      {
        onSuccess: (response) => {
          // 登入成功
          if (response.user && response.token) {
            toast({
              title: '登入成功',
              description: `歡迎回來，${response.user.firstName || ''}！`,
            });

            // 導航到儀表板
            setLocation('/dashboard');
          } else {
            // 檢查是否需要郵箱驗證
            if (response.needsVerification) {
              toast({
                title: '郵箱未驗證',
                description: '請先驗證你的郵箱才能登入',
                variant: 'destructive',
              });
              setLocation('/verify-email-prompt');
            }
          }
        },
        onError: (err: any) => {
          // 錯誤已通過 error state 顯示
          // 檢查是否是郵箱驗證錯誤
          if (err?.response?.status === 403 && err?.response?.data?.needsVerification) {
            toast({
              title: '郵箱未驗證',
              description: '請先驗證你的郵箱才能登入',
              variant: 'destructive',
            });
            setLocation('/verify-email-prompt');
          } else {
            toast({
              title: '登入失敗',
              description: err?.response?.data?.error || err?.response?.data?.message || '請檢查你的帳號和密碼',
              variant: 'destructive',
            });
          }
        },
      }
    );
  };

  /**
   * 處理忘記密碼點擊
   */
  const handleForgotPassword = (): void => {
    // TODO: 實現忘記密碼功能
    toast({
      title: '功能開發中',
      description: '忘記密碼功能即將推出',
    });
  };

  /**
   * 處理註冊連結點擊
   */
  const handleRegister = (): void => {
    setLocation('/register-flow');
  };

  // 提取錯誤訊息
  const errorMessage =
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    (error && typeof error === 'object' && 'message' in error
      ? String((error as any).message)
      : undefined);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden">
      {/* 背景裝飾 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-600 rounded-full blur-3xl"></div>
      </div>

      {/* 頂部返回按鈕 */}
      <div className="w-full pt-6 pb-4 px-4 flex items-center z-10 relative">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 rounded-md px-2 py-1"
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">返回</span>
        </button>
      </div>

      {/* 主要內容區域 */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4 py-8 z-10 relative">
        <div className="w-full max-w-md space-y-8">
          {/* 標題區域 */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-white">
              登入你的帳號
            </h1>
            <p className="text-lg text-gray-400">歡迎回來</p>
          </div>

          {/* 表單容器 */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* 錯誤訊息顯示 */}
            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                <p className="text-red-500 text-sm font-medium">{errorMessage}</p>
              </div>
            )}

            {/* Email 輸入框 */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                className="bg-slate-900/50 border-slate-700 text-white placeholder:text-white/40 focus:border-emerald-500 focus:ring-emerald-500"
                disabled={isPending}
                {...register('email')}
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && (
                <p id="email-error" className="text-red-500 text-sm" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password 輸入框 */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="至少 6 個字符"
                className="bg-slate-900/50 border-slate-700 text-white placeholder:text-white/40 focus:border-emerald-500 focus:ring-emerald-500"
                disabled={isPending}
                {...register('password')}
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={errors.password ? 'password-error' : undefined}
              />
              {errors.password && (
                <p id="password-error" className="text-red-500 text-sm" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* 記住我和忘記密碼 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  disabled={isPending}
                  checked={rememberMe}
                  onCheckedChange={(checked) => setValue('rememberMe', !!checked)}
                  className="border-slate-700 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
                <Label
                  htmlFor="rememberMe"
                  className="text-sm text-white/80 cursor-pointer"
                  onClick={() => setValue('rememberMe', !rememberMe)}
                >
                  記住我
                </Label>
              </div>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isPending}
                className="text-sm text-emerald-400 hover:text-emerald-300 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 rounded-md px-1"
              >
                忘記密碼？
              </button>
            </div>

            {/* 登入按鈕 */}
            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-3 text-base rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 shadow-lg hover:shadow-emerald-500/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="登入"
              data-testid="button-login"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  登入中...
                </>
              ) : (
                '登入'
              )}
            </Button>
          </form>

          {/* 分隔線 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-950 text-white/60">或</span>
            </div>
          </div>

          {/* OAuth 按鈕 */}
          <div className="space-y-3">
            {/* Apple 登入 */}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // TODO: 實現 Apple 登入
                toast({
                  title: '功能開發中',
                  description: 'Apple 登入功能即將推出',
                });
              }}
              disabled={isPending}
              className="w-full border-2 border-white/20 hover:border-white/40 bg-transparent hover:bg-white/5 text-white font-semibold py-6 text-lg rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-[0.98]"
            >
              🍎 使用 Apple 登入
            </Button>

            {/* Google 登入 */}
            <div className="w-full">
              <GoogleLoginButton />
            </div>
          </div>

          {/* 註冊連結 */}
          <div className="text-center">
            <p className="text-sm text-white/60">
              沒有帳號？{' '}
              <button
                type="button"
                onClick={handleRegister}
                disabled={isPending}
                className="text-emerald-400 hover:text-emerald-300 hover:underline font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 rounded-md px-1"
              >
                立即註冊
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
