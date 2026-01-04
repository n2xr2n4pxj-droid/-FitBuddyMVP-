import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle2, RefreshCw } from "lucide-react";

export default function VerifyEmailPrompt() {
  const [location, setLocation] = useLocation();
  const [email, setEmail] = useState<string>("");
  const [isChecking, setIsChecking] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxChecks = 28800; // 24 小時 = 28800 次（每 3 秒一次）

  // 🔍 調試日誌：組件加載和路由信息
  useEffect(() => {
    console.log("🔍 VerifyEmailPrompt 組件已加載");
    console.log("📧 當前路徑:", location);
    const queryString = location.split('?')[1];
    if (queryString) {
      const params = new URLSearchParams(queryString);
      console.log("📧 查詢參數:", Object.fromEntries(params.entries()));
    } else {
      console.log("📧 查詢參數: 無");
    }
  }, [location]);

  // ✅ 從 URL 參數或路由狀態獲取郵箱地址
  useEffect(() => {
    // 從 URL 參數獲取
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    
    if (emailParam) {
      setEmail(emailParam);
    } else {
      // 嘗試從 sessionStorage 獲取（如果從註冊頁面跳轉過來）
      const storedEmail = sessionStorage.getItem("pendingVerificationEmail");
      if (storedEmail) {
        setEmail(storedEmail);
      }
    }
  }, []);

  // ✅ 檢查郵箱驗證狀態
  const checkEmailVerification = async () => {
    if (!email || isVerified) return;

    try {
      setIsChecking(true);
      const response = await fetch(
        `/api/v1/auth/check-email-verified?email=${encodeURIComponent(email)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      const data = await response.json();

      if (response.ok && data.emailVerified === true) {
        setIsVerified(true);
        setCheckCount((prev) => prev + 1);
        
        // 清除定時器
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }

        // 清除 sessionStorage
        sessionStorage.removeItem("pendingVerificationEmail");

        // 延遲 1 秒後跳轉到登錄頁面
        setTimeout(() => {
          setLocation("/auth/login?verified=true");
        }, 1000);
      } else {
        setCheckCount((prev) => {
          const newCount = prev + 1;
          // 如果超過最大檢查次數，停止檢查
          if (newCount >= maxChecks && intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          return newCount;
        });
      }
    } catch (error) {
      console.error("Check email verification error:", error);
    } finally {
      setIsChecking(false);
    }
  };

  // ✅ 自動檢查郵箱驗證狀態
  useEffect(() => {
    if (!email || isVerified) return;

    // 立即檢查一次
    checkEmailVerification();

    // 設置定時器，每 3 秒檢查一次
    intervalRef.current = setInterval(() => {
      checkEmailVerification();
    }, 3000);

    // 清理函數
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, isVerified]);

  // ✅ 手動重新檢查
  const handleRefresh = () => {
    checkEmailVerification();
  };

  // ✅ 跳轉到重新發送驗證郵件頁面
  const handleResend = () => {
    setLocation(`/resend-verification?email=${encodeURIComponent(email)}`);
  };

  // ✅ 返回登錄
  const handleBackToLogin = () => {
    setLocation("/auth/login");
  };

  if (!email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <Card className="shadow-xl">
            <CardContent className="pt-6">
              <Alert variant="destructive">
                <AlertDescription>
                  未找到郵箱地址，請返回註冊頁面重新註冊。
                </AlertDescription>
              </Alert>
              <Button
                onClick={handleBackToLogin}
                className="w-full mt-4"
                variant="outline"
              >
                返回登錄
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto mb-4 bg-blue-100 rounded-full p-3 w-fit">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-3xl font-bold">
              請驗證你所註冊的郵箱
            </CardTitle>
            <CardDescription>
              我們已向你發送驗證郵件，請檢查郵箱並點擊驗證鏈接
            </CardDescription>
            {/* ✅ 重要提示：必須驗證郵箱才能使用應用 */}
            <Alert variant="default" className="mt-4 border-orange-200 bg-orange-50">
              <AlertDescription className="text-orange-800 font-semibold">
                ⚠️ 請驗證你的郵箱才能使用應用功能
              </AlertDescription>
            </Alert>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 郵箱地址顯示 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">郵箱地址</p>
              <p className="text-lg font-semibold text-blue-900">{email}</p>
            </div>

            {/* 驗證成功提示 */}
            {isVerified && (
              <Alert variant="default" className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  郵箱驗證成功！正在跳轉到登錄頁面...
                </AlertDescription>
              </Alert>
            )}

            {/* 檢查狀態指示 */}
            {!isVerified && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                {isChecking ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>正在檢查驗證狀態...</span>
                  </>
                ) : (
                  <span>每 3 秒自動檢查一次</span>
                )}
              </div>
            )}

            {/* 提示信息 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                💡 提示：
              </p>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>郵件可能需要幾分鐘到達</li>
                <li>請檢查垃圾郵件/促銷文件夾</li>
                <li>確認郵箱地址是否正確：{email}</li>
                <li>驗證鏈接將在 24 小時內有效</li>
              </ul>
            </div>

            {/* 按鈕組 */}
            <div className="space-y-3">
              <Button
                onClick={handleResend}
                variant="default"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isVerified}
              >
                <Mail className="h-4 w-4 mr-2" />
                重新發送驗證郵件
              </Button>

              <Button
                onClick={handleRefresh}
                variant="ghost"
                className="w-full"
                disabled={isVerified || isChecking}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
                立即檢查驗證狀態
              </Button>

              <Button
                onClick={handleBackToLogin}
                variant="outline"
                className="w-full"
              >
                返回登錄
              </Button>
            </div>

            {/* 檢查次數（調試用，可選） */}
            {process.env.NODE_ENV === "development" && (
              <p className="text-xs text-center text-muted-foreground">
                已檢查 {checkCount} 次
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
