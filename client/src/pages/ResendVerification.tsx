import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResendVerification() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ 從 URL 參數中獲取 email（如果有的話）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedEmail) {
        setError("請輸入郵箱地址");
        setIsLoading(false);
        return;
      }

      // ✅ 驗證郵箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setError("請輸入有效的郵箱地址");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/v1/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || data?.message || "發送失敗，請稍後再試");
        toast({
          title: "發送失敗",
          description: data?.error || data?.message || "無法發送驗證郵件",
          variant: "destructive",
        });
      } else {
        setSuccess(true);
        toast({
          title: "郵件已發送",
          description: "驗證郵件已發送，請檢查你的郵箱",
        });
      }
    } catch (err: any) {
      console.error("Resend verification error:", err);
      const errorMessage = err.message || "發送失敗，請稍後再試";
      setError(errorMessage);
      toast({
        title: "發生錯誤",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto mb-4 bg-blue-100 rounded-full p-3 w-fit">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-3xl font-bold">重新發送驗證郵件</CardTitle>
            <CardDescription>
              輸入你的郵箱地址，我們將重新發送驗證郵件
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 成功提示 */}
            {success && (
              <Alert variant="default" className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  驗證郵件已發送，請檢查你的郵箱
                </AlertDescription>
              </Alert>
            )}

            {/* 錯誤提示 */}
            {error && !success && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* 表單 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 郵箱輸入 */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  電子郵件
                </label>
                <Input
                  type="email"
                  id="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                    setSuccess(false);
                  }}
                  required
                  disabled={isLoading}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  請輸入你註冊時使用的郵箱地址
                </p>
              </div>

              {/* 發送按鈕 */}
              <Button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    發送中...
                  </>
                ) : (
                  "發送驗證郵件"
                )}
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

            {/* 返回登錄 */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                已經驗證過了？
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/auth/login")}
                className="w-full"
              >
                返回登錄
              </Button>
            </div>

            {/* 提示信息 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>💡 提示：</strong> 驗證郵件將在 24 小時內有效。如果沒有收到郵件，請檢查垃圾郵件文件夾。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

