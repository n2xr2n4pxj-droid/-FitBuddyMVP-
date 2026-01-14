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

        // ✅ OAuth 註冊流程修復：使用新的註冊狀態 API 檢查完整註冊流程
        try {
          // ✅ 確保使用正確的 token 格式
          const tokenForAPI = accessToken || tokenManager.getAccessToken();
          if (!tokenForAPI) {
            console.error('[GoogleLoginButton] ❌ No access token available for API call');
            throw new Error('No access token available');
          }

          // ✅ 添加超時和錯誤處理
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 秒超時

          // 調用註冊狀態檢查 API
          const registrationStatusResponse = await fetch('/api/auth/registration-status', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenForAPI}`,
            },
            credentials: 'include',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          let registrationStatus = 'incomplete';
          let nextStep: number | null = null;

          if (registrationStatusResponse.ok) {
            const statusData = await registrationStatusResponse.json();
            registrationStatus = statusData.data?.registrationStatus || 'incomplete';
            nextStep = statusData.data?.nextStep || null;
            
            console.log('[GoogleLoginButton] ✅ Registration status check:', {
              registrationStatus,
              nextStep,
              completedSteps: statusData.data?.completedSteps,
            });
          } else {
            const errorData = await registrationStatusResponse.json().catch(() => ({}));
            console.error('[GoogleLoginButton] ⚠️ Registration status API failed:', {
              status: registrationStatusResponse.status,
              error: errorData.error || errorData.message,
            });
            // ✅ API 失敗時，假設未完成並重定向到步驟 3（TDEE 設置開始）
            registrationStatus = 'partial';
            nextStep = 3;
          }

          // ✅ 使用 window.location.replace 防止返回按鈕混亂，並添加延遲防止競態條件
          setTimeout(() => {
            setLoading(false);
            
            console.log('[GoogleLoginButton] 🔀 Redirecting based on registration status:', {
              registrationStatus,
              nextStep,
            });
            
            if (registrationStatus === 'complete') {
              // 已完成所有註冊步驟，重定向到 Dashboard
              console.log('[GoogleLoginButton] → Registration complete, redirecting to /dashboard');
              window.location.replace('/dashboard');
            } else if (registrationStatus === 'partial' && nextStep) {
              // 部分完成，重定向到相應的註冊步驟
              console.log(`[GoogleLoginButton] → Registration partial, redirecting to /register?step=${nextStep}`);
              window.location.replace(`/register?step=${nextStep}`);
            } else {
              // 未完成，重定向到步驟 1（開始註冊流程）
              console.log('[GoogleLoginButton] → Registration incomplete, redirecting to /register?step=1');
              window.location.replace('/register?step=1');
            }
          }, 300); // ✅ 減少延遲時間，從 500ms 改為 300ms
        } catch (statusError: any) {
          // ✅ 如果註冊狀態檢查失敗，假設未完成並重定向到註冊流程步驟 3
          console.error('[GoogleLoginButton] ❌ Registration status check error:', statusError);
          setTimeout(() => {
            setLoading(false);
            // 錯誤時，假設需要完成 TDEE 設置，重定向到步驟 3
            console.log('[GoogleLoginButton] → Error occurred, redirecting to /register?step=3 (assume TDEE incomplete)');
            window.location.replace('/register?step=3');
          }, 300); // ✅ 減少延遲時間
        }
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

