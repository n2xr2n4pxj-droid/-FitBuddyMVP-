import React, { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import GoogleLoginButton from "@/components/GoogleLoginButton";

export default function AuthLoginPage() {
  const [_, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error, needsVerification } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ 確保 email 和 password 是字符串
    if (typeof email !== 'string' || typeof password !== 'string') {
      console.error('[auth-login] Invalid types:', { 
        emailType: typeof email, 
        passwordType: typeof password 
      });
      return;
    }

    // ✅ 去除空白
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      console.error('[auth-login] Empty email or password');
      return;
    }

    try {
      // ✅ 修復：傳遞兩個獨立的字符串參數，而不是對象
      await login(trimmedEmail, trimmedPassword);
      navigate("/role-selection");
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const errorMessage = error instanceof Error ? error.message : error || "登入失敗，請重試";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold">FitBuddy</CardTitle>
            <CardDescription>登入你的健身教練賬戶</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 錯誤提示 */}
            {error && (
              <Alert variant={needsVerification ? "default" : "destructive"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {needsVerification ? (
                    <div className="space-y-2">
                      <p>你的郵箱未驗證。請檢查郵件或</p>
                      <button
                        type="button"
                        onClick={() => navigate("/resend-verification")}
                        className="text-primary hover:underline font-semibold"
                      >
                        重新發送驗證郵件
                      </button>
                    </div>
                  ) : (
                    errorMessage
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* 登入表單 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 電子郵件 */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  電子郵件
                </label>
                <Input
                  type="email"
                  id="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              {/* 密碼 */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  密碼
                </label>
                <Input
                  type="password"
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              {/* 登入按鈕 */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "登入中..." : "登入"}
              </Button>
            </form>

            {/* 分割線 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">或</span>
              </div>
            </div>

            {/* Google 登錄按鈕 */}
            <GoogleLoginButton />

            {/* 註冊鏈接 */}
            <p className="text-center text-sm text-muted-foreground">
              還沒有賬戶？{" "}
              <button
                onClick={() => navigate("/auth/register")}
                className="text-primary hover:underline font-semibold"
              >
                立即註冊
              </button>
            </p>
          </CardContent>
        </Card>

        {/* 測試提示 */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          測試賬戶：test@example.com / Test123456
        </p>
      </div>
    </div>
  );
}
