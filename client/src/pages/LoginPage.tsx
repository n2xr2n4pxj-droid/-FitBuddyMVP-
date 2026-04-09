import React, { useRef } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/store/auth.store';
import { loginSchema } from '@/schemas/auth';
import { toast } from '@/components/ui/toast';

export const LoginPage: React.FC = () => {
  const [isPending, setIsPending] = React.useState(false);
  const executionLock = useRef<boolean>(false);
  const [, navigate] = useLocation();
  const { login, isAuthLoading } = useAuthStore();

  const handleAuthError = (error: any) => {
    if (error?.message === 'INVALID_USER_DATA') {
      toast.error('伺服器回傳異常資料，請聯繫客服');
      return;
    }
    if (!error?.response) {
      toast.error('連線失敗，請檢查您的網路設定');
      return;
    }
    const { status, data } = error.response;
    if (status === 403 && data?.needsVerification) {
      toast.warning('帳號需要驗證，請檢查電子郵件');
      navigate('/verify-email');
    } else if (status === 401 || status === 404) {
      if (data?.code === 'USER_NOT_FOUND') {
        toast.error('找不到此帳號，請先註冊');
        navigate('/register-flow?step=1');
      } else {
        toast.error('帳號或密碼錯誤');
      }
    } else {
      toast.error(data?.message || '發生未知錯誤，請稍後再試');
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (executionLock.current || isAuthLoading) return;

    const formData = new FormData(event.currentTarget);
    const rawData = Object.fromEntries(formData.entries());

    const validation = loginSchema.safeParse(rawData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    executionLock.current = true;
    setIsPending(true);

    try {
      await login(validation.data.email, validation.data.password);
      navigate('/');
    } catch (error) {
      handleAuthError(error);
    } finally {
      setIsPending(false);
      executionLock.current = false;
    }
  };

  return (
  <div className="flex min-h-screen items-center justify-center px-4">
    <div className="w-full max-w-md space-y-8 rounded-lg border bg-card p-8 shadow-lg">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-primary">FitBuddy 登入</h2>
        <p className="text-sm text-muted-foreground mt-2">請輸入您的帳號密碼以繼續</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            電子郵件
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-50"
            placeholder="name@example.com"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            密碼
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-50"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || isAuthLoading}
          className="inline-flex w-full justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isPending || isAuthLoading ? '登入中...' : '登入'}
        </button>
      </form>
    </div>
  </div>
);
};
