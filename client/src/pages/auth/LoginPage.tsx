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

  /**
   * 精準的錯誤處理邏輯 (Error Mapping)
   */
  const handleAuthError = (error: any) => {
    // 1. 【修正】優先處理自定義的業務錯誤，避免誤導使用者
    if (error?.message === 'INVALID_USER_DATA') {
      toast.error('伺服器回傳異常資料，請聯繫客服');
      return;
    }

    // 2. 檢查是否為網路層級錯誤 (例如 Nginx 回傳 HTML Error Page)
    if (!error?.response) {
      toast.error('連線失敗，請檢查您的網路設定');
      return;
    }

    const { status, data } = error.response;

    // 3. 根據後端約定的狀態碼進行精準引導
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

    // Zod 驗證 (包含 trim 與 max length)
    const validation = loginSchema.safeParse(rawData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    executionLock.current = true;
    setIsPending(true);

    try {
      // 1. 執行登入
      await login(validation.data.email, validation.data.password);

      // 2. 【關鍵修正】先等待 store/state 與渲染週期同步完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 3. 執行跳轉
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
      <div className="w-full max-w-md space-y-6 rounded-lg border p-8 shadow-lg">
        <div className="text-center">
          <h2 className="text-2xl font-bold">FitBuddy 登入</h2>
          <p className="text-sm text-muted-foreground mt-1">請輸入帳號密碼</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              電子郵件
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@example.com"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              密碼
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || isAuthLoading}
            className="inline-flex w-full justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isPending || isAuthLoading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
};
