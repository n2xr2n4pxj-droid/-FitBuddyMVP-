import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useLocation } from 'wouter';
import { toast } from '@/components/ui/toast';

export const GoogleCallback: React.FC = () => {
  const { loginWithOAuth } = useAuthStore();
  const [, navigate] = useLocation();
  const hasExecuted = useRef<boolean>(false);

  useEffect(() => {
    if (hasExecuted.current) return;
    hasExecuted.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      toast.error('找不到授權碼，請重新嘗試登入');
      navigate('/login');
      return;
    }

    loginWithOAuth(code)
      .then(() => {
        navigate('/');
      })
      .catch((err) => {
        console.error('[GoogleCallback] OAuth flow failed:', err);
        navigate('/login');
      });
  }, [loginWithOAuth, navigate]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <span className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">正在完成 Google 驗證...</p>
      </div>
    </div>
  );
};
