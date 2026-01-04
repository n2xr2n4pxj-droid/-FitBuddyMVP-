import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { tokenManager } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

export default function GoogleLoginButton() {
  const [, setLocation] = useLocation();
  const { setUser, setToken, setRefreshToken } = useAuthStore();
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
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Google 登錄失敗');
        }

        const data = await response.json();

        console.log('[GoogleLoginButton] Login successful:', {
          hasToken: !!data.token,
          hasRefreshToken: !!data.refreshToken,
          userId: data.user?.id,
        });

        // 保存 tokens 到 localStorage
        if (data.token) {
          tokenManager.setAccessToken(data.token);
        }
        if (data.refreshToken) {
          tokenManager.setRefreshToken(data.refreshToken);
        }

        // 更新 auth store
        if (data.user) {
          setUser({
            id: String(data.user.id),
            email: data.user.email,
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            avatar: data.user.avatar,
            role: data.user.role || 'client',
            createdAt: data.user.createdAt,
            emailVerified: data.user.emailVerified ?? true,
          });
        }

        if (data.token) {
          setToken(data.token);
        }
        if (data.refreshToken) {
          setRefreshToken(data.refreshToken);
        }

        // 確保認證狀態已更新
        // setUser 會自動設置 isAuthenticated = true

        // 500ms 後重定向到 dashboard
        setTimeout(() => {
          setLoading(false);
          setLocation('/');
        }, 500);
      } catch (err: any) {
        console.error('[GoogleLoginButton] Error:', err);
        setError(err.message || 'Google 登錄失敗，請稍後再試');
        setLoading(false);
      }
    },
    onError: (errorResponse) => {
      console.error('[GoogleLoginButton] Google OAuth error:', errorResponse);
      setError('Google 登錄失敗，請稍後再試');
      setLoading(false);
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
        disabled={loading}
        className="w-full"
        variant="outline"
      >
        {loading ? '登錄中...' : '🔐 Google 登錄'}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

