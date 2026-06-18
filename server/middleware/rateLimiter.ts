import { ipKeyGenerator, rateLimit, type Options } from "express-rate-limit";

// RATE_LIMIT_ENABLED=false 可暫時關閉（預設開啟）
// 跑 7.4 驗收測試前請確認此值不為 false。
const isEnabled = process.env.RATE_LIMIT_ENABLED !== "false";

const loginRateLimitMax = Number(
  process.env.LOGIN_RATE_LIMIT_MAX ??
    (process.env.NODE_ENV === "production" ? 5 : 30),
);

const base: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isEnabled,
};

/** 登入：production 5 次 / 15 分鐘 / IP；development 預設 30 次（避免 e2e 串測誤觸 429） */
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: loginRateLimitMax,
  message: {
    success: false,
    errorCode: "RATE_LIMIT_EXCEEDED",
    message: "嘗試次數過多，請 15 分鐘後再試",
  },
});

/** 註冊 / 忘記密碼：3 次 / 1 小時 / IP */
export const registerLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    errorCode: "RATE_LIMIT_EXCEEDED",
    message: "操作過於頻繁，請 1 小時後再試",
  },
});

/** 邀請發送：10 次 / 1 小時 / 用戶 */
export const invitationLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) =>
    req.user?.id ?? req.user?.claims?.sub ?? ipKeyGenerator(req.ip ?? ""),
  message: {
    success: false,
    errorCode: "RATE_LIMIT_EXCEEDED",
    message: "邀請發送次數超限，請 1 小時後再試",
  },
});

/** AI 端點：20 次 / 分鐘 / 用戶 */
export const aiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req: any) =>
    req.user?.id ?? req.user?.claims?.sub ?? ipKeyGenerator(req.ip ?? ""),
  message: {
    success: false,
    errorCode: "RATE_LIMIT_EXCEEDED",
    message: "AI 請求過於頻繁，請稍後再試",
  },
});

/** 一般 API 保底：100 次 / 分鐘 / IP（下一波啟用） */
export const generalLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 100,
  message: {
    success: false,
    errorCode: "RATE_LIMIT_EXCEEDED",
    message: "請求過於頻繁，請稍後再試",
  },
});
