export type AuthRoleWire =
  | "USER"
  | "COACH"
  | "ADMIN"
  | "BOTH"
  | "user"
  | "coach"
  | "admin"
  | "both"
  | "client";

export interface UserPayload {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  role?: AuthRoleWire | string;
  createdAt?: string | null;
  username?: string | null;
}

export interface AuthPayload {
  success?: boolean;
  message?: string;
  needsVerification?: boolean;
  error?: string;
  user?: UserPayload;
  token?: string;
  refreshToken?: string;
}

export interface AuthApiResponse extends AuthPayload {
  data?: Partial<AuthPayload> & {
    user?: UserPayload;
  };
}

export interface MePayload extends UserPayload {
  registrationComplete?: boolean;
  hasTDEEComplete?: boolean;
  hasRole?: boolean;
  nextStep?: number | null;
}

export function extractAuthPayload(raw: any): AuthPayload {
  if (!raw) return {};
  const base = raw?.data && typeof raw.data === "object" ? raw.data : raw;
  const nested = base?.data && typeof base.data === "object" ? base.data : null;
  const source = nested ?? base;
  return {
    success: source?.success,
    message: source?.message,
    needsVerification: source?.needsVerification,
    error: source?.error,
    user: source?.user,
    token: source?.token,
    refreshToken: source?.refreshToken,
  };
}
