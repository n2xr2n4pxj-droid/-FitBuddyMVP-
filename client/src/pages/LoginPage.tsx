/**
 * @deprecated 請改用 `pages/auth/LandingPage` + `pages/auth/LoginPage` 未登入流程；此檔保留供參考。
 */
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("coach@fitbuddy.hk");
  const [password, setPassword] = useState("password123");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await login(email.trim(), password.trim());
    } catch (error) {
      const apiError = error as ApiError;
      setErrorMessage(apiError.message || "登入失敗，請稍後再試");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-md mx-auto">
        <div className="bg-white/90 backdrop-blur-md rounded-[20px] shadow-sm shadow-blue-100/50 p-5">
          <h1 className="text-2xl font-bold text-gray-900">登入 FitBuddy</h1>
          <p className="mt-1 text-sm text-gray-500">歡迎返嚟，今日都繼續撐住！</p>

          {errorMessage ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm text-gray-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-900 outline-none focus:border-blue-500"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-700">密碼</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-900 outline-none focus:border-blue-500"
                required
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-white font-semibold active:scale-95 transition-transform disabled:opacity-60"
            >
              {isSubmitting ? "登入中..." : "登入"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            沒有帳號？用邀請連結註冊
          </p>
        </div>
      </div>
    </div>
  );
}

