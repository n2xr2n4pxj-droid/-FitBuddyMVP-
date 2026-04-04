import { useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { type User } from "@/lib/api";
import { api as apiClient, tokenManager } from "@/lib/api-client";
import { extractAuthPayload, type UserPayload } from "@/types/auth-payload";

interface DecodedToken {
  user?: User;
  sub?: string;
  email?: string;
  role?: User["role"] | string;
  exp: number;
}

function normalizeRole(role: string | undefined): User["role"] {
  const upper = (role ?? "").toUpperCase();
  if (upper === "COACH" || upper === "BOTH") {
    return "COACH";
  }
  return "USER";
}

function normalizeRoleInput(role: string): "client" | "coach" | "admin" {
  const lower = role.toLowerCase();
  if (lower === "coach" || lower === "both") return "coach";
  if (lower === "admin") return "admin";
  return "client";
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  isAuthenticated: boolean;
  isCoach: boolean;
  isClient: boolean;
  isBoth: boolean;
}

interface UseAuthResult extends AuthState {
  login: (email: string, password: string) => Promise<User>;
  register: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => Promise<User>;
  selectRole: (role: "client" | "coach" | "both" | "admin") => Promise<User>;
  fetchMe: () => Promise<User | null>;
  error: string | null;
  needsVerification: boolean;
  logout: () => void;
}

const TOKEN_KEY = "fitbuddy_token";
const USER_KEY = "fitbuddy_user";

function toUser(userFromApi: UserPayload): User {
  return {
    id: userFromApi.id,
    email: userFromApi.email,
    name: `${userFromApi.firstName ?? ""} ${userFromApi.lastName ?? ""}`.trim() || userFromApi.email,
    firstName: userFromApi.firstName ?? undefined,
    lastName: userFromApi.lastName ?? undefined,
    role: normalizeRole(userFromApi.role),
  };
}

export const useAuth = (): UseAuthResult => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState<boolean>(false);

  const clearAuthState = (redirectToLogin: boolean): void => {
    // 必須同步清除 tokenManager（fitbuddy_access_token / refresh），否則 axios 攔截器仍會帶舊 token 並在 refresh 失敗時強制導向 /login（註冊頁輸入時若觸發任何 API 會中斷流程）
    tokenManager.clear();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
    setError(null);
    setNeedsVerification(false);

    if (redirectToLogin) {
      window.location.href = "/login";
    }
  };

  useEffect(() => {
    const storedToken = tokenManager.getAccessToken() || localStorage.getItem(TOKEN_KEY);
    const storedUserRaw = localStorage.getItem(USER_KEY);

    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(storedToken);
      const isExpired = decoded.exp * 1000 < Date.now();

      if (isExpired) {
        clearAuthState(true);
        setIsLoading(false);
        return;
      }

      let resolvedUser: User | null = null;

      // 優先使用 token 內嵌 user（舊格式）
      if (decoded.user) {
        resolvedUser = {
          ...decoded.user,
          role: normalizeRole(decoded.user.role),
        };
      } else if (storedUserRaw) {
        // 新後端 token 不含 user 時，回退使用 localStorage 快取
        try {
          const parsed = JSON.parse(storedUserRaw) as User;
          resolvedUser = {
            ...parsed,
            role: normalizeRole(parsed.role),
          };
        } catch {
          resolvedUser = null;
        }
      } else if (decoded.sub && decoded.email && decoded.role) {
        // 最後回退：從 token 基本欄位建最小 user
        resolvedUser = {
          id: decoded.sub,
          email: decoded.email,
          role: normalizeRole(String(decoded.role)),
          name: decoded.email.split("@")[0],
        };
      }

      if (!resolvedUser) {
        clearAuthState(true);
        setIsLoading(false);
        return;
      }

      setToken(storedToken);
      // 如果是舊 key 讀到 token，順手同步到新 token manager
      tokenManager.setAccessToken(storedToken);
      setUser(resolvedUser);
    } catch {
      // token decode 失敗時自動清理，避免 app crash
      clearAuthState(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setError(null);
    setNeedsVerification(false);
    try {
      const raw = await apiClient.auth.login(email, password);
      const payload = extractAuthPayload(raw);
      if (!payload.user || !payload.token) {
        throw new Error("登入回應缺少 user 或 token");
      }
      const normalizedUser = toUser(payload.user);
      localStorage.setItem(TOKEN_KEY, payload.token);
      localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
      tokenManager.setAccessToken(payload.token);
      if (payload.refreshToken) {
        tokenManager.setRefreshToken(payload.refreshToken);
      }
      setToken(payload.token);
      setUser(normalizedUser);
      return normalizedUser;
    } catch (e: any) {
      const status = e?.response?.status ?? e?.statusCode;
      const payload = extractAuthPayload(e?.response);
      const message =
        payload.error ||
        e?.response?.data?.message ||
        (typeof e?.message === "string" ? e.message : "登入失敗，請重試");
      if (payload.needsVerification || status === 403 || String(message).includes("驗證")) {
        setNeedsVerification(true);
      }
      setError(String(message));
      throw e;
    }
  };

  const register = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ): Promise<User> => {
    setError(null);
    setNeedsVerification(false);
    try {
      const raw = await apiClient.auth.register(email, password, firstName, lastName);
      const payload = extractAuthPayload(raw);
      const tokenFromApi = payload.token;
      const userFromApi = payload.user;
      if (!userFromApi) {
        throw new Error("註冊回應缺少 user");
      }
      const normalizedUser = toUser(userFromApi);
      if (tokenFromApi) {
        localStorage.setItem(TOKEN_KEY, tokenFromApi);
        tokenManager.setAccessToken(tokenFromApi);
        if (payload.refreshToken) {
          tokenManager.setRefreshToken(payload.refreshToken);
        }
        setToken(tokenFromApi);
      }
      localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      return normalizedUser;
    } catch (e: any) {
      const message =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || "註冊失敗，請重試";
      setError(String(message));
      throw e;
    }
  };

  const selectRole = async (
    role: "client" | "coach" | "both" | "admin",
  ): Promise<User> => {
    setError(null);
    const normalizedRole = normalizeRoleInput(role);
    try {
      const raw = await apiClient.auth.selectRole(normalizedRole);
      const payload = extractAuthPayload(raw);
      const tokenFromApi = payload.token;
      const userFromApi = payload.user;
      if (!userFromApi) {
        throw new Error("角色更新回應缺少 user");
      }
      const normalizedUser = toUser(userFromApi);
      if (tokenFromApi) {
        localStorage.setItem(TOKEN_KEY, tokenFromApi);
        tokenManager.setAccessToken(tokenFromApi);
        if (payload.refreshToken) {
          tokenManager.setRefreshToken(payload.refreshToken);
        }
        setToken(tokenFromApi);
      }
      localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      return normalizedUser;
    } catch (e: any) {
      const message =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || "角色設定失敗";
      setError(String(message));
      throw e;
    }
  };

  const fetchMe = async (): Promise<User | null> => {
    try {
      const raw = await apiClient.auth.me();
      const data = raw?.data ?? raw;
      const normalizedUser = toUser(data);
      localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      return normalizedUser;
    } catch (e: any) {
      const message =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || "獲取使用者失敗";
      setError(String(message));
      return null;
    }
  };

  const logout = (): void => {
    tokenManager.clear();
    clearAuthState(true);
  };

  const isLoggedIn = !!token && !!user;
  const isAuthenticated = isLoggedIn;
  const isCoach = useMemo(() => user?.role === "COACH", [user]);
  const isClient = useMemo(() => user?.role === "USER", [user]);
  // legacy compatibility: BOTH retired in the new role model
  const isBoth = false;

  return {
    user,
    token,
    isLoading,
    isLoggedIn,
    isAuthenticated,
    isCoach,
    isClient,
    isBoth,
    login,
    register,
    selectRole,
    fetchMe,
    error,
    needsVerification,
    logout,
  };
};
