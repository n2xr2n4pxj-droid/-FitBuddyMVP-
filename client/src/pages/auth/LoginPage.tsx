/**
 * FitBuddy 登入頁面組件
 *
 * 使用 React + TypeScript + Tailwind CSS + React Hook Form
 * 使用 wouter 進行路由導航（專案使用 wouter 而非 react-router-dom）
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter';
import { ArrowLeft, Loader2, Lock, Mail } from 'lucide-react';
import { AiFillApple } from 'react-icons/ai';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import GoogleLoginButton from '@/components/GoogleLoginButton';
import { useToast } from '@/hooks/use-toast';
import AuthPhoneShell from '@/components/auth/AuthPhoneShell';
import authService from '@/services/authService';
import { clearPendingCoachRef, getPendingCoachRef } from '@/lib/coach-ref';

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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const rememberMe = watch('rememberMe');

  const handleBack = (): void => {
    setLocation('/');
  };

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    setSubmitError(null);
    setIsPending(true);
    try {
      const user = await login(data.email.trim(), data.password);
      const pendingCoachRef = getPendingCoachRef();
      if (pendingCoachRef) {
        try {
          const result = await authService.applyCoachRef(pendingCoachRef);
          if (result.linked || result.alreadyLinked) {
            clearPendingCoachRef();
            toast({
              title: result.alreadyLinked ? '邀請來源' : '邀請來源已更新',
              description: result.alreadyLinked
                ? '你的帳戶已與此教練邀請來源綁定'
                : '已自動綁定你的教練邀請來源',
            });
          }
        } catch (applyErr) {
          // 補償流程失敗不阻斷登入
          console.warn('[LoginPage] applyCoachRef failed:', applyErr);
        }
      }
      toast({
        title: '登入成功',
        description: `歡迎回來，${user.firstName || user.name || ''}！`,
      });
      window.location.assign('/');
    } catch (err: any) {
      const status = err?.response?.status ?? err?.statusCode;
      const resData = err?.response?.data;

      if (status === 403 && resData?.needsVerification) {
        toast({
          title: '郵箱未驗證',
          description: '請先驗證你的郵箱才能登入',
          variant: 'destructive',
        });
        setLocation('/verify-email-prompt');
        return;
      }

      if (status === 404 || resData?.error === 'USER_NOT_FOUND') {
        const errorMessage = resData?.message || '你的帳戶並未註冊，請先註冊';
        toast({
          title: '帳戶不存在',
          description: errorMessage,
          variant: 'destructive',
        });
        window.setTimeout(() => {
          setLocation('/register-flow?step=1');
        }, 1000);
        return;
      }

      const msg =
        resData?.error ||
        resData?.message ||
        err?.message ||
        '請檢查你的帳號和密碼';
      setSubmitError(String(msg));
      toast({
        title: '登入失敗',
        description: String(msg),
        variant: 'destructive',
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleForgotPassword = (): void => {
    toast({
      title: '功能開發中',
      description: '忘記密碼功能即將推出',
    });
  };

  const handleRegister = (): void => {
    setLocation('/register-flow');
  };

  return (
    <AuthPhoneShell>
      <div className="relative flex shrink-0 items-center justify-center px-6 pt-6">
        <button
          type="button"
          onClick={handleBack}
          className="absolute left-6 top-6 flex items-center gap-2 rounded-md px-2 py-1 text-white/80 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-950"
          aria-label="返回"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">返回</span>
        </button>

        <div className="w-full text-center">
          <h1 className="text-white text-2xl font-bold">登入 FitBuddy</h1>
          <p className="text-neutral-400 text-sm">結合權威監督與朋友鼓勵...</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-8 text-white">
        <div className="w-full space-y-6">
          {/* Social Login First */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              disabled
              className="w-full flex justify-center gap-3 px-4 py-2.5 border border-neutral-700 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition-colors opacity-40 cursor-not-allowed"
              aria-label="Apple 登入"
            >
              <AiFillApple className="h-5 w-5 text-white" aria-hidden />
              繼續使用 Apple（即將推出）
            </Button>

            <GoogleLoginButton
              flow="login"
              buttonClassName="w-full flex justify-center gap-3 px-4 py-2.5 border border-neutral-700 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-neutral-800" />
            <span className="px-4 bg-neutral-950 text-neutral-500 text-sm">
              或使用電郵登入
            </span>
            <div className="flex-1 border-t border-neutral-800" />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {submitError && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
                <p className="text-sm font-medium text-red-500">{submitError}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-600" />
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  className="pl-10 pr-3 bg-neutral-950/60 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  disabled={isPending}
                  {...register('email')}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
              </div>
              {errors.email && (
                <p id="email-error" className="text-sm text-red-500" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-600" />
                <Input
                  id="password"
                  type="password"
                  placeholder="至少 6 個字符"
                  className="pl-10 pr-3 bg-neutral-950/60 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  disabled={isPending}
                  {...register('password')}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
              </div>
              {errors.password && (
                <p id="password-error" className="text-sm text-red-500" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  disabled={isPending}
                  checked={rememberMe}
                  onCheckedChange={(checked) => setValue('rememberMe', !!checked)}
                  className="border-slate-700 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                />
                <Label
                  htmlFor="rememberMe"
                  className="cursor-pointer text-sm text-white/80"
                  onClick={() => setValue('rememberMe', !rememberMe)}
                >
                  記住我
                </Label>
              </div>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isPending}
                className="text-blue-500 hover:text-blue-300 hover:underline focus:outline-none"
              >
                忘記密碼？
              </button>
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-md"
              aria-label="登入"
              data-testid="button-login"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  登入中...
                </>
              ) : (
                '登入'
              )}
            </Button>
          </form>

          {/* Sign Up Prompt */}
          <div className="pt-2 text-center text-neutral-400 text-sm">
            還沒有帳戶？
            {' '}
            <button
              type="button"
              onClick={handleRegister}
              disabled={isPending}
              className="text-blue-500 hover:text-blue-300 hover:underline font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-950 rounded-md px-1"
            >
              立即免費註冊
            </button>
          </div>
        </div>
      </div>
    </AuthPhoneShell>
  );
}
