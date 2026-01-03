import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, isLoading, error, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // 如果已認證，根據角色重定向
  useEffect(() => {
    if (isAuthenticated) {
      if (!user?.role) {
        setLocation('/role-selection');
      } else if (user.role === 'coach' || user.role === 'both') {
        setLocation('/coach-dashboard');
      } else {
        setLocation('/client-dashboard');
      }
    }
  }, [isAuthenticated, user, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    // ✅ 早期類型檢查：確保 email 和 password 是字符串
    if (typeof email !== 'string' || typeof password !== 'string') {
      console.error('[LoginPage] Invalid types:', { 
        emailType: typeof email, 
        passwordType: typeof password,
        emailValue: email,
      });
      logger.error('LOGIN', 'Invalid login parameters', {
        emailType: typeof email,
        passwordType: typeof password,
        emailValue: email,
        timestamp: new Date().toISOString(),
      });
      setLocalError('登入數據格式錯誤，請重新輸入');
      return;
    }

    // ✅ 詳細日誌：檢查類型和值
    console.log('[LoginPage] Email type:', typeof email, 'Email value:', email);
    console.log('[LoginPage] Password type:', typeof password, 'Password has value:', !!password);

    logger.info('LOGIN', 'Login attempt - type check', { 
      emailType: typeof email, 
      passwordType: typeof password,
      emailIsString: typeof email === 'string',
      passwordIsString: typeof password === 'string',
    });

    // ✅ 確保 email 和 password 是字符串，並去除空白
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    console.log('[LoginPage] After trim:', {
      trimmedEmail,
      trimmedEmailType: typeof trimmedEmail,
      trimmedPassword,
      trimmedPasswordType: typeof trimmedPassword,
    });

    if (!trimmedEmail || !trimmedPassword) {
      setLocalError('請輸入郵箱和密碼');
      return;
    }

    // ✅ 最終驗證：確保不是 [object Object]（雖然已經通過類型檢查，但作為額外防護）
    if (trimmedEmail.includes('[object') || trimmedPassword.includes('[object')) {
      console.error('[LoginPage] Object stringification detected:', { trimmedEmail, trimmedPassword });
      setLocalError('登入數據格式錯誤，請重新輸入');
      return;
    }

    try {
      logger.info('LOGIN', 'Login attempt', { 
        email: trimmedEmail.substring(0, 3) + '***',
        emailLength: trimmedEmail.length,
        passwordLength: trimmedPassword.length,
      });
      
      console.log('[LoginPage] Before login call:', {
        email: trimmedEmail,
        emailType: typeof trimmedEmail,
        password: trimmedPassword,
        passwordType: typeof trimmedPassword,
      });
      
      // ✅ 直接傳遞清理後的 email 和 password（確保是字符串）
      await login(trimmedEmail, trimmedPassword);
      
      logger.info('LOGIN', 'Login successful', { email: trimmedEmail.substring(0, 3) + '***' });
      
      // 登入成功後，useEffect 會根據用戶角色自動重定向
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Login failed';
      setLocalError(errorMessage);
      logger.error('LOGIN', 'Login failed', { 
        email: trimmedEmail.substring(0, 3) + '***', 
        error: errorMessage 
      });
    }
  };

  if (isAuthenticated) {
    return null; // useEffect 會處理重定向
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-8">
          FitBuddy
        </h1>

        {(error || localError) && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error || localError}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              郵箱
            </label>
            <input
              type="email"
              value={typeof email === 'string' ? email : ''}
              onChange={(e) => {
                const value = e.target.value;
                // ✅ 確保設置的是字符串
                if (typeof value === 'string') {
                  setEmail(value);
                } else {
                  console.error('[LoginPage] Invalid email value type:', typeof value, value);
                  setEmail('');
                }
              }}
              required
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              密碼
            </label>
            <input
              type="password"
              value={typeof password === 'string' ? password : ''}
              onChange={(e) => {
                const value = e.target.value;
                // ✅ 確保設置的是字符串
                if (typeof value === 'string') {
                  setPassword(value);
                } else {
                  console.error('[LoginPage] Invalid password value type:', typeof value, value);
                  setPassword('');
                }
              }}
              required
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '登入中...' : '登入'}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          還沒有帳戶?{' '}
          <a 
            href="/register" 
            className="text-blue-600 font-semibold hover:underline"
            onClick={(e) => {
              e.preventDefault();
              setLocation('/register');
            }}
          >
            註冊
          </a>
        </p>
      </div>
    </div>
  );
}

