import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function AuthRegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const [validationError, setValidationError] = useState("");
  const { register, isLoading, error } = useAuth();
  const registerLoading = isLoading;
  const registerError = error;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setValidationError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    // 驗證密碼一致性
    if (formData.password !== formData.confirmPassword) {
      setValidationError("密碼不一致");
      return;
    }

    // 驗證密碼長度
    if (formData.password.length < 8) {
      setValidationError("密碼至少需要 8 個字符");
      return;
    }

    try {
      // ✅ 修復：register 函數需要 4 個獨立參數，不是一個對象
      await register(
        formData.email,
        formData.password,
        formData.firstName || undefined,
        formData.lastName || undefined
      );

      // ✅ 保存郵箱地址（在清除表單前）
      const registeredEmail = formData.email;

      // ✅ 清除表單數據
      setFormData({
        email: "",
        password: "",
        confirmPassword: "",
        firstName: "",
        lastName: "",
      });

      // ✅ 註冊成功，顯示成功提示
      toast({
        title: "註冊成功",
        description: "請檢查郵箱並點擊驗證鏈接",
      });

      // ✅ 跳轉到驗證提示頁面
      setLocation(`/verify-email-prompt?email=${encodeURIComponent(registeredEmail)}`);
    } catch (err) {
      console.error("Registration failed:", err);
    }
  };

  const errorMessage =
    validationError ||
    (typeof registerError === 'string' ? registerError : (registerError && typeof registerError === 'object' && 'message' in registerError ? String((registerError as any).message) : "註冊失敗，請重試"));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold">FitBuddy</CardTitle>
            <CardDescription>創建你的健身教練賬戶</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 錯誤提示 */}
            {(validationError || registerError) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* 註冊表單 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 名字和姓氏 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="firstName" className="text-sm font-medium">
                    名字
                  </label>
                  <Input
                    type="text"
                    id="firstName"
                    name="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={registerLoading || isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="lastName" className="text-sm font-medium">
                    姓氏
                  </label>
                  <Input
                    type="text"
                    id="lastName"
                    name="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={registerLoading || isLoading}
                  />
                </div>
              </div>

              {/* 電子郵件 */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  電子郵件
                </label>
                <Input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={registerLoading || isLoading}
                />
              </div>

              {/* 密碼 */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  密碼 (至少 8 個字符)
                </label>
                <Input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={registerLoading || isLoading}
                />
              </div>

              {/* 確認密碼 */}
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                  確認密碼
                </label>
                <Input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={registerLoading || isLoading}
                />
              </div>

              {/* 註冊按鈕 */}
              <Button
                type="submit"
                disabled={registerLoading}
                className="w-full"
              >
                {registerLoading ? "註冊中..." : "創建賬戶"}
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

            {/* 登入鏈接 */}
            <p className="text-center text-sm text-muted-foreground">
              已有賬戶？{" "}
              <button
                onClick={() => setLocation("/login")}
                className="text-primary hover:underline font-semibold"
              >
                立即登入
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
