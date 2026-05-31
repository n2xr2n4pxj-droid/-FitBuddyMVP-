import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function VerifyEmail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // 從 URL 路徑參數獲取 token（路由是 /auth/verify-email/:token）
    const token = params?.token;

    if (!token) {
      setStatus('error');
      setError('驗證鏈接無效：缺少驗證令牌');
      return;
    }

    // 調用後端 API 驗證郵箱
    const verifyEmail = async () => {
      try {
        setStatus('loading');
        setMessage('正在驗證您的郵箱...');

        const response = await fetch(`/api/v1/auth/verify-email/${token}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include',
        });

        // 檢查響應類型
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('[VerifyEmail] Received non-JSON response:', {
            status: response.status,
            contentType,
            textPreview: text.substring(0, 200),
          });
          throw new Error('服務器返回了非 JSON 響應，請檢查後端配置');
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.message || '驗證失敗');
        }

        // 驗證成功
        if (data.success) {
          setStatus('success');
          if (data.alreadyVerified) {
            setMessage('您的郵箱已經驗證過了！');
          } else {
            setMessage('郵箱驗證成功！您現在可以登錄了。');
          }

          // 顯示成功提示
          toast({
            title: '驗證成功',
            description: '您的郵箱已成功驗證，正在跳轉到登錄頁面...',
          });

          // 3 秒後重定向到登錄頁面
          setTimeout(() => {
            setLocation('/auth/login?verified=true');
          }, 3000);
        } else {
          throw new Error(data.error || '驗證失敗');
        }
      } catch (err: any) {
        console.error('Email verification error:', err);
        setStatus('error');
        setError(err.message || '驗證郵箱時發生錯誤，請稍後再試');
        
        toast({
          title: '驗證失敗',
          description: err.message || '無法驗證郵箱，請檢查鏈接是否有效',
          variant: 'destructive',
        });
      }
    };

    verifyEmail();
  }, [params?.token, setLocation, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold">FitBuddy</CardTitle>
          <CardDescription>郵箱驗證</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 加載狀態 */}
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
              <p className="text-lg font-medium text-gray-700">{message || '正在驗證您的郵箱...'}</p>
              <p className="text-sm text-gray-500">請稍候，這可能需要幾秒鐘</p>
            </div>
          )}

          {/* 成功狀態 */}
          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">驗證成功！</h2>
                <p className="text-gray-600">{message}</p>
                <p className="text-sm text-gray-500 mt-4">正在跳轉到登錄頁面...</p>
              </div>
              <Button
                onClick={() => setLocation('/auth/login?verified=true')}
                className="w-full"
              >
                立即登錄
              </Button>
            </div>
          )}

          {/* 錯誤狀態 */}
          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="rounded-full bg-red-100 p-4">
                <AlertCircle className="h-12 w-12 text-red-600" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">驗證失敗</h2>
                <p className="text-gray-600">{error}</p>
                <p className="text-sm text-gray-500 mt-4">
                  驗證鏈接可能已過期或無效。請檢查您的郵件或聯繫支持。
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Button
                  onClick={() => {
                    // 重新嘗試驗證
                    window.location.reload();
                  }}
                  variant="default"
                  className="w-full"
                >
                  重試驗證
                </Button>
                <Button
                  onClick={() => setLocation('/auth/login')}
                  variant="outline"
                  className="w-full"
                >
                  返回登錄
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

