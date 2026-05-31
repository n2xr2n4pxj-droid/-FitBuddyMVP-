import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { tokenManager } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';
import { isCoachRole, isClientRole, isBothRole } from '@/utils/role';
import { cn } from '@/lib/utils';
import authService from '@/services/authService';
import { clearPendingCoachRef, getPendingCoachRef } from '@/lib/coach-ref';
import { FcGoogle } from 'react-icons/fc';

interface GoogleLoginButtonProps {
  flow?: 'register' | 'login'; // ← 添加 flow 參數
  buttonClassName?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export default function GoogleLoginButton({ 
  flow = 'login', // ← 默認為 login
  buttonClassName,
  onSuccess,
  onError
}: GoogleLoginButtonProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isLoading } = useAuth();
  const { fetchMe, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const googleLogin = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async (codeResponse) => {
      try {
        setLoading(true);
        setError(null);

        console.log('[GoogleLoginButton] Authorization code received');

        // POST 到後端 /auth/google/callback
        const response = await fetch('/api/auth/google/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            code: codeResponse.code,
            clientId: clientId,
            flow: flow, // ← 傳遞 flow 參數給後端
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          console.log('[GoogleLoginButton] ❌ Error:', {
            status: response.status,
            error: errorData.error,
            message: errorData.message,
          });

          // 根據錯誤類型進行處理
          if (errorData.error === 'USER_ALREADY_EXISTS') {
            // 用戶已存在 → 切換到登入頁面
            const errorMessage = errorData.message || '你的帳戶已註冊，請使用登入功能';
            console.log('[GoogleLoginButton] → User already exists, redirecting to /login');
            setLoading(false);
            setError(errorMessage);
            if (onError) onError(errorMessage);
            setTimeout(() => {
              setLocation('/login');
            }, 1000);
            return;
          }

          if (errorData.error === 'USER_NOT_FOUND') {
            // 用戶不存在 → 切換到註冊頁面
            const errorMessage = errorData.message || '你的帳戶並未註冊，請先註冊';
            console.log('[GoogleLoginButton] → User not found, redirecting to /register?step=1');
            setLoading(false);
            setError(errorMessage);
            if (onError) onError(errorMessage);
            setTimeout(() => {
              setLocation('/register?step=1');
            }, 1000);
            return;
          }

          throw new Error(errorData.error || errorData.message || 'Google 登錄失敗');
        }

        const data = await response.json();

        console.log('[GoogleLoginButton] ✅ Response received:', {
          hasToken: !!data.token,
          hasRefreshToken: !!data.refreshToken,
          hasAccessToken: !!data.accessToken,
          tokenLength: data.token?.length,
          refreshTokenLength: data.refreshToken?.length,
          userId: data.user?.id,
          responseKeys: Object.keys(data),
        });

        // ✅ 確定要保存的 token 值（後端可能返回 token 或 accessToken）
        const accessToken = data.accessToken || data.token;
        const refreshToken = data.refreshToken || '';

        if (!accessToken) {
          console.error('[GoogleLoginButton] ❌ No access token in response:', data);
          throw new Error('登入失敗：未收到 access token');
        }

        // ✅ 保存 tokens 到 localStorage（使用 tokenManager）
        console.log('[GoogleLoginButton] 💾 Saving tokens to localStorage...');
        tokenManager.setAccessToken(accessToken);
        if (refreshToken) {
          tokenManager.setRefreshToken(refreshToken);
        }

        // ✅ 同時保存到 'accessToken' 和 'refreshToken' key（向後兼容）
        localStorage.setItem('accessToken', accessToken);
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }

        // ✅ 確認保存成功
        const savedAccessToken = localStorage.getItem('accessToken');
        const savedRefreshToken = localStorage.getItem('refreshToken');
        const savedFitbuddyAccessToken = tokenManager.getAccessToken();
        const savedFitbuddyRefreshToken = tokenManager.getRefreshToken();

        console.log('[GoogleLoginButton] ✅ Token saved confirmation:', {
          'accessToken': !!savedAccessToken,
          'refreshToken': !!savedRefreshToken,
          'fitbuddy_access_token': !!savedFitbuddyAccessToken,
          'fitbuddy_refresh_token': !!savedFitbuddyRefreshToken,
          accessTokenLength: savedAccessToken?.length,
          refreshTokenLength: savedRefreshToken?.length,
        });

        // ✅ 以伺服器為準：token 已在 tokenManager，fetchMe 一次 set 寫入 user / registrationComplete / nextStep
        try {
          await fetchMe();
        } catch (meErr) {
          console.error('[GoogleLoginButton] fetchMe failed after OAuth:', meErr);
          tokenManager.clear();
          await logout();
          setLoading(false);
          setError('登入驗證失敗，請重新登入');
          if (onError) onError('登入驗證失敗，請重新登入');
          setLocation('/login');
          return;
        }

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
            // 補償流程失敗不阻斷 OAuth 登入
            console.warn('[GoogleLoginButton] applyCoachRef failed:', applyErr);
          }
        }

        const { registrationComplete: complete, nextStep: step, user: meUser } = useAuthStore.getState();
        const stepNum = step ?? 3;

        if (onSuccess) {
          onSuccess(data);
        }

        setLoading(false);

        if (complete) {
          const role = (meUser?.role ?? '').toString().toLowerCase();
          if (isCoachRole(role)) {
            setLocation('/coach-dashboard');
          } else if (isClientRole(role) || isBothRole(role)) {
            setLocation('/client-dashboard');
          } else {
            setLocation('/dashboard');
          }
        } else {
          setLocation(`/register-flow?step=${stepNum}`);
        }
      } catch (err: any) {
        console.error('[GoogleLoginButton] Error:', err);
        const errorMessage = err.message || 'Google 登錄失敗，請稍後再試';
        setError(errorMessage);
        setLoading(false);
        if (onError) onError(errorMessage);
      }
    },
    onError: (errorResponse) => {
      console.error('[GoogleLoginButton] Google OAuth error:', errorResponse);
      const errorMessage = 'Google 登錄失敗，請稍後再試';
      setError(errorMessage);
      setLoading(false);
      if (onError) onError(errorMessage);
    },
  });

  if (!clientId) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          缺少 Google OAuth 配置，請聯繫管理員
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={() => googleLogin()}
        disabled={loading || isLoading}
        className={cn("w-full", buttonClassName)}
        variant="outline"
      >
        {loading || isLoading ? (
          '登錄中...'
        ) : (
          <>
            <FcGoogle className="h-5 w-5" aria-hidden />
            Google 登錄
          </>
        )}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

