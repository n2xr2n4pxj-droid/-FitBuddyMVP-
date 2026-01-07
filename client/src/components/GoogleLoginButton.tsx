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

        if (accessToken) {
          setToken(accessToken);
        }
        if (refreshToken) {
          setRefreshToken(refreshToken);
        }

        // 確保認證狀態已更新
        // setUser 會自動設置 isAuthenticated = true

        // ✅ 檢查用戶是否有角色，如果沒有則重定向到角色選擇頁面
        // 如果用戶有角色，則重定向到對應的 dashboard
        setTimeout(() => {
          setLoading(false);
          const userRole = data.user?.role;
          console.log('[GoogleLoginButton] 🔀 Redirecting, user role:', userRole);
          if (!userRole) {
            // 沒有角色，重定向到角色選擇頁面
            console.log('[GoogleLoginButton] → Redirecting to /role-selection');
            setLocation('/role-selection');
          } else {
            // 有角色，重定向到主頁（App.tsx 會根據角色路由到對應的 dashboard）
            console.log('[GoogleLoginButton] → Redirecting to /');
            setLocation('/');
          }
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

