import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: any = { email, password };
      if (mode === "register") {
        body.firstName = firstName || undefined;
        body.lastName = lastName || undefined;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // 確保包含 cookies/session
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast({
          title: mode === "login" ? "登入失敗" : "註冊失敗",
          description: data?.message || "請稍後再試",
          variant: "destructive",
        });
        return;
      }

      // 使認證查詢失效，強制重新獲取用戶信息
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // 等待查詢更新
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });

      toast({
        title: mode === "login" ? "登入成功" : "註冊成功",
        description:
          mode === "login"
            ? "歡迎回來！"
            : "帳號已建立並自動登入，為你導向儀表板。",
      });

      // 使用 window.location 強制刷新，確保認證狀態更新
      window.location.href = "/";
    } catch (error) {
      console.error("Auth error:", error);
      toast({
        title: "發生錯誤",
        description: "無法完成操作，請確認伺服器有啟動。",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">
            {mode === "login" ? "登入 FitBuddy" : "建立你的 FitBuddy 帳號"}
          </h1>
          <p className="text-sm text-muted-foreground">
            本機開發用的簡單 Email / 密碼登入
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">名字（可選）</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">姓氏（可選）</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">密碼</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
            data-testid={mode === "login" ? "button-submit-login" : "button-submit-register"}
          >
            {submitting
              ? "處理中..."
              : mode === "login"
                ? "登入"
                : "註冊並登入"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => setMode("register")}
            >
              還沒有帳號？點此註冊
            </button>
          ) : (
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => setMode("login")}
            >
              已經有帳號？改為登入
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}


