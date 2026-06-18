import { Router } from 'express';
import { db, pool } from '../db';
import { users, coachClients } from '../db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { hashPassword, verifyPassword, isAuthenticated, verifyJWT } from '../replitAuth';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { 
  getUserById, 
  getUserByEmail, 
  updateUserRole,
  createUser 
} from '../db/queries';
import emailService from '../services/emailService';
import { sendEmail } from '../services/emailService';
import { config } from '../config/env';
import { sendError } from '../lib/response';
import { ErrorCodes } from '@shared/error-codes';

const router = Router();

// ==========================================
// JWT 配置（從環境變量管理系統讀取）
// ==========================================
// 生產環境必須設置，開發環境可以使用默認值
const getJWTSecret = (): string => {
  const secret = config.jwt.secret || (config.app.env === 'production' ? '' : 'dev-jwt-secret-key');
  if (!secret && config.app.env === 'production') {
    throw new Error('JWT_SECRET must be set in production environment');
  }
  return secret;
};

const getRefreshTokenSecret = (): string => {
  const secret = config.jwt.refreshSecret || (config.app.env === 'production' ? '' : 'dev-refresh-token-secret-key');
  if (!secret && config.app.env === 'production') {
    throw new Error('REFRESH_TOKEN_SECRET must be set in production environment');
  }
  return secret;
};

const JWT_SECRET = getJWTSecret();
const REFRESH_TOKEN_SECRET = getRefreshTokenSecret();
const ACCESS_TOKEN_EXPIRATION = config.jwt.accessTokenExpiration;
const REFRESH_TOKEN_EXPIRATION = config.jwt.refreshTokenExpiration;

// ==========================================
// Google OAuth 配置（從環境變量管理系統讀取）
// ==========================================
const googleConfig = {
  clientId: config.google.clientId,
  clientSecret: config.google.clientSecret,
  redirectUri: config.google.callbackUrl,
};

// ==========================================
// Token 生成輔助函數
// ==========================================
interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  tv: number;
}

function tokenVersionOf(user: { tokenVersion?: number | null }): number {
  return user.tokenVersion ?? 0;
}

async function bumpUserTokenVersion(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

const generateAccessToken = (payload: TokenPayload) => {
  const expiresIn: string | number = ACCESS_TOKEN_EXPIRATION || "60m";
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
  } as SignOptions);
};

const generateRefreshToken = (userId: string, tv: number) => {
  const expiresIn: string | number = REFRESH_TOKEN_EXPIRATION || '30d';
  return jwt.sign({ sub: userId, tv }, REFRESH_TOKEN_SECRET, {
    expiresIn,
  } as SignOptions);
};

const REFRESH_COOKIE_NAME = 'fitbuddy_refresh_token';

function refreshCookieMaxAgeMs(): number {
  const exp = String(REFRESH_TOKEN_EXPIRATION || '30d');
  const match = exp.match(/^(\d+)([dhms])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  switch (match[2]) {
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    case 's':
      return value * 1000;
    default:
      return 30 * 24 * 60 * 60 * 1000;
  }
}

function refreshCookieOptions() {
  const isProd = config.app.env === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/api/auth',
    maxAge: refreshCookieMaxAgeMs(),
  };
}

function setRefreshCookie(res: any, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

function clearRefreshCookie(res: any) {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
}

// ==========================================
// 角色工具函數
// ==========================================

/**
 * 標準化角色為大寫值
 * - 支援舊系統 'coach' / 'client'
 * - 新系統使用 'USER' | 'COACH' | 'ADMIN'
 */
function normalizeRoleToUpperCase(role?: string | null): 'USER' | 'COACH' | 'ADMIN' {
  if (!role) return 'USER';

  const r = role.toString().toUpperCase();

  // 舊系統小寫兼容
  if (r === 'COACH') return 'COACH';
  if (r === 'CLIENT') return 'USER';

  if (r === 'USER' || r === 'COACH' || r === 'ADMIN') {
    return r as 'USER' | 'COACH' | 'ADMIN';
  }
  // 舊資料兼容：BOTH 已廢棄，統一提升為 COACH
  if (r === 'BOTH') {
    return 'COACH';
  }

  return 'USER';
}

// 驗證角色是否有效（接受小寫和大寫）
function isValidRole(role: any): boolean {
  if (!role) return false;
  const r = role.toString().toLowerCase();
  return ['client', 'coach', 'admin', 'user'].includes(r);
}

// ==========================================
// POST /auth/register - 用戶註冊
// ==========================================
router.post('/auth/register',  async (req: any, res: any) => {
  try {
    const { email, password, firstName, lastName, username, role, coachRef, coach_ref } =
      req.body;
    const coachRefToken = coachRef || coach_ref;
    let referredCoachId: string | null = null;

    const rawHandle =
      typeof username === "string" && username.trim()
        ? username.trim()
        : typeof firstName === "string" && firstName.trim()
          ? firstName.trim()
          : null;
    /** username 欄位存小寫，與 check-username 的 lower 比對一致，並避免大小寫重複 */
    const usernameForDb = rawHandle ? rawHandle.toLowerCase() : null;

    console.log('[POST /auth/register]', {
      email,
      username: usernameForDb,
      firstName,
      lastName,
      role,
      hasCoachRef: !!coachRefToken,
    });

    if (!email || !password) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'Email and password are required');
    }

    if (password.length < 8) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'Password must be at least 8 characters');
    }

    if (coachRefToken) {
      try {
        const decoded = jwt.verify(String(coachRefToken), JWT_SECRET) as any;
        if (decoded?.type !== 'coach_ref' || !decoded?.coachId) {
          return res.status(400).json({ message: 'Invalid coach_ref token' });
        }

        const coachId = String(decoded.coachId);
        const coachUser = await getUserById(coachId);
        const coachRole = normalizeRoleToUpperCase(coachUser?.role);
        if (!coachUser || (coachRole !== 'COACH' && coachRole !== 'ADMIN')) {
          return res.status(400).json({ message: 'Invalid coach_ref owner' });
        }

        referredCoachId = coachId;
      } catch (error) {
        return res.status(400).json({ message: 'Invalid or expired coach_ref token' });
      }
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return sendError(
        res,
        409,
        ErrorCodes.AUTH_USER_EXISTS,
        '你的帳戶已註冊，請使用登入功能',
        { details: { email } },
      );
    }

    const passwordHash = hashPassword(password);

    // 標準化角色
    let normalizedRole = 'USER';
    if (role && isValidRole(role)) {
      normalizedRole = normalizeRoleToUpperCase(role);
    }

    // ✅ 生成郵箱驗證 token（未加密的原始 token，用於郵件鏈接）
    const rawToken = crypto.randomBytes(32).toString('hex');
    
    // ✅ 使用 SHA256 哈希 token 後保存到資料庫（安全存儲）
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    
    // ✅ 設置過期時間為 24 小時後（毫秒時間戳）
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 小時 = 86400000 毫秒

    console.log('[POST /auth/register] 生成驗證 token:', {
      rawTokenLength: rawToken.length,
      hashedTokenLength: hashedToken.length,
      expiresAt: new Date(expiresAt).toISOString(),
    });

    const newUser = await createUser({
      email,
      passwordHash,
      username: usernameForDb,
      firstName,
      lastName,
      role: normalizedRole,
      emailVerificationToken: hashedToken, // ✅ 保存哈希後的 token
      emailVerified: false,
      emailVerificationExpires: expiresAt, // ✅ 保存過期時間
    });

    if (newUser && referredCoachId) {
      const existingRelationship = await db
        .select({ id: coachClients.id })
        .from(coachClients)
        .where(
          and(
            eq(coachClients.coachId, referredCoachId),
            eq(coachClients.clientId, String(newUser.id))
          )
        )
        .limit(1);

      if (existingRelationship.length === 0) {
        await db.insert(coachClients).values({
          coachId: referredCoachId,
          clientId: String(newUser.id),
          status: 'active',
        });
      }
    }

    // ✅ 發送驗證郵件（使用未加密的原始 token）
    try {
      await emailService.sendVerificationEmail(email, rawToken);
      console.log('[POST /auth/register] 驗證郵件已發送:', email);
    } catch (emailError) {
      console.error('[POST /auth/register] 發送驗證郵件失敗:', emailError);
      // 不阻止註冊，但記錄錯誤
    }

    if (!newUser) {
      console.error('[POST /auth/register] Failed to create user - no user returned');
      return res.status(500).json({ message: 'Failed to create user' });
    }

    // ✅ 註冊成功，但不返回 token（用戶需要先驗證郵箱）
    // 使用資料庫中實際存儲的 role 值
    const userRole = newUser.role || 'USER';

    console.log('[POST /auth/register] Success - user created, email verification required:', { 
      id: newUser.id, 
      email: newUser.email,
      role: userRole 
    });

    // ✅ 不返回 token，要求用戶先驗證郵箱
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email before logging in.',
      referral: referredCoachId
        ? {
            coachId: referredCoachId,
            linked: true,
          }
        : null,
      // ✅ 不返回 token 和 refreshToken
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName || null,
        lastName: newUser.lastName || null,
        avatar: newUser.avatar || null,
        role: userRole,
        createdAt: newUser.createdAt || null,
        emailVerified: false, // ✅ 明確標記郵箱未驗證
      },
    });
  } catch (error) {
    console.error('[POST /auth/register] Error:', error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to register user');
  }
});

// ==========================================
// POST /auth/login - 用戶登入
// ==========================================
router.post('/auth/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;

    console.log('[POST /auth/login]', { email });

    if (!email || !password) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'Email and password are required');
    }

    const user = await getUserByEmail(email);

    if (!user) {
      console.log('[POST /auth/login] User not found:', email);
      return sendError(
        res,
        404,
        ErrorCodes.AUTH_USER_NOT_FOUND,
        '你的帳戶並未註冊，請先註冊',
        { details: { email } },
      );
    }

    if (!user.passwordHash) {
      console.log('[POST /auth/login] User has no password hash:', email);
      return sendError(res, 401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Invalid credentials');
    }

    const passwordValid = verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      console.log('[POST /auth/login] Invalid password for:', email);
      return sendError(res, 401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Invalid credentials');
    }

    // ✅ 檢查郵箱是否已驗證
    if (!user.emailVerified) {
      console.log('[POST /auth/login] ❌ Email not verified for:', email);
      return sendError(
        res,
        403,
        ErrorCodes.AUTH_VERIFICATION_REQUIRED,
        '請先驗證你的郵箱',
        { details: { needsVerification: true } },
      );
    }

    // 直接使用資料庫中的 role 值（'USER', 'COACH', 'ADMIN'）
    const userRole = normalizeRoleToUpperCase(user.role);
    const tv = tokenVersionOf(user);

    // 生成 tokens
    const accessToken = generateAccessToken({
      sub: String(user.id),
      email: user.email || '',
      role: userRole,
      tv,
    });

    const refreshToken = generateRefreshToken(String(user.id), tv);

    console.log('[POST /auth/login] Success:', { id: user.id, role: userRole });

    const { passwordHash, ...safeUser } = user as any;

    setRefreshCookie(res, refreshToken);

    res.json({
      success: true,
      message: 'Login successful',
      token: accessToken,
      user: {
        id: safeUser.id,
        email: safeUser.email,
        firstName: safeUser.firstName || null,
        lastName: safeUser.lastName || null,
        avatar: safeUser.avatar || null,
        role: userRole, // 直接返回資料庫原始值
        createdAt: safeUser.createdAt || null,
      },
    });
  } catch (error) {
    console.error('[POST /auth/login] Error:', error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to login');
  }
});

// ==========================================
// POST /auth/apply-coach-ref - 補償綁定 coach referral
// ==========================================
router.post('/auth/apply-coach-ref', verifyJWT, async (req: any, res: any) => {
  try {
    const userId = String(req.user?.id || req.user?.claims?.sub || '').trim();
    if (!userId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const coachRefToken = String(req.body?.coachRef || req.body?.coach_ref || '').trim();
    if (!coachRefToken) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'coachRef is required');
    }

    let coachId = '';
    try {
      const decoded = jwt.verify(coachRefToken, JWT_SECRET) as any;
      if (decoded?.type !== 'coach_ref' || !decoded?.coachId) {
        return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'Invalid coach_ref token');
      }
      coachId = String(decoded.coachId).trim();
    } catch {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'Invalid or expired coach_ref token');
    }

    if (!coachId || coachId === userId) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'Invalid coach_ref owner');
    }

    const coachUser = await getUserById(coachId);
    const coachRole = normalizeRoleToUpperCase(coachUser?.role);
    if (!coachUser || (coachRole !== 'COACH' && coachRole !== 'ADMIN')) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'Invalid coach_ref owner');
    }

    const existingRelationship = await db
      .select({ id: coachClients.id })
      .from(coachClients)
      .where(
        and(
          eq(coachClients.coachId, coachId),
          eq(coachClients.clientId, userId)
        )
      )
      .limit(1);

    if (existingRelationship.length > 0) {
      return res.status(200).json({
        success: true,
        linked: false,
        alreadyLinked: true,
        coachId,
      });
    }

    await db.insert(coachClients).values({
      coachId,
      clientId: userId,
      status: 'active',
    });

    return res.status(200).json({
      success: true,
      linked: true,
      coachId,
    });
  } catch (error) {
    console.error('[POST /auth/apply-coach-ref] Error:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to apply coach_ref');
  }
});

// ==========================================
// POST /auth/forgot-password - 發送重設密碼郵件
// ==========================================
router.post('/auth/forgot-password', async (req: any, res: any) => {
  try {
    const { email } = req.body ?? {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await getUserByEmail(normalizedEmail);

    // 防止帳號枚舉：無論是否存在都回同樣訊息
    if (!user) {
      return res.json({
        success: true,
        message: '如果該郵箱已註冊，重設密碼郵件已發送',
      });
    }

    const resetToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        type: 'password_reset',
      },
      JWT_SECRET,
      { expiresIn: '1h' } as SignOptions,
    );

    const appUrl = config.app.appUrl || config.app.clientUrl;
    const resetLink = `${appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #111827; line-height: 1.6;">
  <h2 style="margin: 0 0 12px;">重設你的 FitBuddy 密碼</h2>
  <p>我們收到你的重設密碼請求。請點擊以下按鈕在 1 小時內完成重設：</p>
  <p style="margin: 20px 0;">
    <a href="${resetLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
      重設密碼
    </a>
  </p>
  <p>如果按鈕無法使用，請複製以下連結到瀏覽器：</p>
  <p style="word-break: break-all; font-size: 12px; color: #4b5563;">${resetLink}</p>
  <p style="font-size:12px; color:#6b7280; margin-top:16px;">如果這不是你本人操作，請忽略本郵件。</p>
</div>
    `;

    const sendResult = await emailService.sendEmail({
      to: normalizedEmail,
      subject: 'FitBuddy 密碼重設請求',
      html,
      type: 'password_reset',
    });

    if (!sendResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send reset email',
        error: sendResult.error || 'Unknown email error',
        logId: sendResult.logId,
      });
    }

    return res.json({
      success: true,
      message: '如果該郵箱已註冊，重設密碼郵件已發送',
      logId: sendResult.logId,
    });
  } catch (error) {
    console.error('[POST /auth/forgot-password] Error:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to process forgot password request');
  }
});

// ==========================================
// POST /auth/reset-password - 忘記密碼重設（JWT reset token）
// ==========================================
router.post('/auth/reset-password', async (req: any, res: any) => {
  try {
    const { token, password, newPassword } = req.body ?? {};
    const nextPassword = typeof newPassword === 'string' ? newPassword : password;

    if (!token || typeof token !== 'string') {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'Reset token is required');
    }
    if (!nextPassword || typeof nextPassword !== 'string') {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'New password is required');
    }
    if (nextPassword.length < 8) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'Password must be at least 8 characters');
    }

    let decoded: { sub?: string; type?: string; email?: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { sub?: string; type?: string; email?: string };
    } catch (verifyErr: any) {
      if (verifyErr.name === 'TokenExpiredError') {
        return sendError(res, 401, ErrorCodes.AUTH_TOKEN_EXPIRED, 'Reset token expired');
      }
      return sendError(res, 401, ErrorCodes.AUTH_TOKEN_INVALID, 'Invalid reset token');
    }

    if (decoded.type !== 'password_reset' || !decoded.sub) {
      return sendError(res, 401, ErrorCodes.AUTH_TOKEN_INVALID, 'Invalid reset token');
    }

    const userId = String(decoded.sub);
    const user = await getUserById(userId);
    if (!user) {
      return sendError(res, 404, ErrorCodes.AUTH_USER_NOT_FOUND, 'User not found');
    }

    await db
      .update(users)
      .set({
        passwordHash: hashPassword(nextPassword),
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    clearRefreshCookie(res);

    return res.json({
      success: true,
      message: 'Password has been reset. Please log in again.',
    });
  } catch (error) {
    console.error('[POST /auth/reset-password] Error:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to reset password');
  }
});

// ==========================================
// POST /auth/change-password - 已登入使用者改密碼
// ==========================================
router.post('/auth/change-password', verifyJWT, async (req: any, res: any) => {
  try {
    const userId = String(req.user?.id || req.user?.claims?.sub || '').trim();
    if (!userId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
    }

    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'Current and new password are required');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'Password must be at least 8 characters');
    }

    const [row] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!row?.passwordHash) {
      return sendError(res, 404, ErrorCodes.AUTH_USER_NOT_FOUND, 'User not found');
    }

    if (!verifyPassword(String(currentPassword), row.passwordHash)) {
      return sendError(res, 401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Current password is incorrect');
    }

    await db
      .update(users)
      .set({
        passwordHash: hashPassword(newPassword),
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    clearRefreshCookie(res);

    return res.json({
      success: true,
      message: 'Password updated. Please log in again.',
    });
  } catch (error) {
    console.error('[POST /auth/change-password] Error:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to change password');
  }
});

router.get('/test-resend', async (_req: any, res: any) => {
  try {
    console.log('⚡️ 準備強制呼叫 Resend...');
    console.log(
      '目前使用的 API KEY:',
      process.env.RESEND_API_KEY ? '已設定 (隱藏內容)' : '未設定 ❌'
    );

    const result = await sendEmail({
      to: 'gordonlai87@gmail.com',
      subject: 'FitBuddy 強制通電測試',
      html: '<p>如果您看到這封信，代表 Resend 引擎運作完全正常！</p>',
    });

    console.log('✅ Resend 呼叫成功:', result);
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('❌ Resend 呼叫失敗:', error);
    res.status(500).json({ success: false, error: error.message || error });
  }
});

// ==========================================
// 共用：角色選擇處理
// ==========================================
const handleRoleSelect = async (req: any, res: any) => {
  try {
    console.log('[SelectRole] ===== START =====');
    console.log('[SelectRole] Request body:', req.body);
    console.log('[SelectRole] req.user:', req.user);

    const userId = req.user?.id;
    
    if (!userId) {
      console.log('[SelectRole] ❌ userId is missing');
      return res.status(401).json({ 
        error: 'Not authenticated',
        debug: { hasUser: !!req.user, userId }
      });
    }

    const { role } = req.body;
    
    if (!role || !isValidRole(role)) {
      console.log('[SelectRole] ❌ Invalid role:', role);
      return res.status(400).json({ 
        error: "Invalid role. Must be 'client', 'coach', 'user', or 'admin'"
      });
    }

    const normalizedRole = normalizeRoleToUpperCase(role);

    console.log('[SelectRole] ✅ Validation passed', { userId, normalizedRole });

    const updatedUser = await updateUserRole(userId, normalizedRole);

    if (!updatedUser) {
      console.log('[SelectRole] ❌ User not found:', userId);
      return sendError(res, 404, ErrorCodes.AUTH_USER_NOT_FOUND, 'User not found');
    }

    // 使用資料庫中實際存儲的 role 值
    const userRole = normalizeRoleToUpperCase(updatedUser.role);
    const tv = tokenVersionOf(updatedUser);

    console.log('[SelectRole] ✅ Database updated:', { id: updatedUser.id, role: userRole });

    // 生成新的 tokens（包含更新後的角色）
    const accessToken = generateAccessToken({
      sub: String(updatedUser.id),
      email: updatedUser.email || '',
      role: userRole,
      tv,
    });

    const refreshToken = generateRefreshToken(String(updatedUser.id), tv);

    setRefreshCookie(res, refreshToken);

    const response = {
      success: true,
      message: 'Role selected successfully',
      token: accessToken,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName || null,
        lastName: updatedUser.lastName || null,
        avatar: updatedUser.avatar || null,
        role: userRole, // 直接返回資料庫原始值
        createdAt: updatedUser.createdAt || null,
      }
    };

    console.log('[SelectRole] ✅ SUCCESS:', response);
    console.log('[SelectRole] ===== END =====');

    return res.status(200).json(response);

  } catch (error) {
    console.error('[SelectRole] ❌ ERROR:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to select role');
  }
};

// 支持兩個路徑：/api/auth/role-select 和 /api/auth/select-role
router.post('/auth/role-select', verifyJWT, handleRoleSelect);
router.post('/auth/select-role', verifyJWT, handleRoleSelect);

// ==========================================
// GET /auth/me - 取得當前用戶
// ==========================================
router.get('/auth/me', async (req: any, res: any) => {
  console.log('[GET /auth/me] ===== START =====');
  try {
    const authHeader = req.headers.authorization;
    console.log('[GET /auth/me] Authorization header:', authHeader ? 'present' : 'missing');

    const token = authHeader?.split(' ')[1];

    if (!token) {
      console.log('[GET /auth/me] ❌ No token provided');
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('[GET /auth/me] ✅ Token verified');
    } catch (verifyErr) {
      console.error('[GET /auth/me] ❌ Token verification failed:', verifyErr);
      return sendError(res, 401, ErrorCodes.AUTH_TOKEN_INVALID, 'Invalid token');
    }

    const userId = decoded.sub;
    console.log('[GET /auth/me] Decoded userId:', userId);

    if (!userId) {
      console.log('[GET /auth/me] ❌ No userId found in token');
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
    }

    const tokenTv = typeof decoded.tv === 'number' ? decoded.tv : 0;

    console.log('[GET /auth/me] Looking up user by id...');
    
    // ✅ 修復：使用與 registration-status 相同的 SQL 查詢方式（直接查詢，支持 UUID）
    // 使用 pool.query() 直接查詢，避免 Drizzle ORM 的類型轉換問題
    let user: any;
    let registrationComplete = true;
    let hasTDEEComplete = false;
    let hasRole = false;
    let nextStep: number | null = null;

    try {
      // 查詢 users 表實際存在的欄位（與 server/db/schema.ts 對齊）
      const result = await pool.query(
        `SELECT id, email, first_name, last_name, role, avatar, created_at, updated_at,
                age, gender, height, weight, activity_level, goal, tdee, token_version
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) {
        console.log('[GET /auth/me] ❌ User not found in database:', userId);
        return sendError(res, 401, ErrorCodes.AUTH_USER_NOT_FOUND, 'User not found');
      }

      const userData = result.rows[0];
      const dbTv = Number(userData.token_version ?? 0);
      if (tokenTv !== dbTv) {
        console.log('[GET /auth/me] ❌ Token revoked (tokenVersion mismatch):', {
          userId,
          tokenTv,
          dbTv,
        });
        return sendError(res, 401, ErrorCodes.AUTH_TOKEN_INVALID, 'Token has been revoked');
      }

      user = {
        id: userData.id,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        role: userData.role,
        avatar: userData.avatar,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at,
      };

      // ✅ 檢查註冊是否完成
      const userRole = userData.role;
      const age = userData.age;
      const gender = userData.gender;
      const height = userData.height ? parseFloat(userData.height) : null;
      const weight = userData.weight ? parseFloat(userData.weight) : null;
      const activityLevel = userData.activity_level || null;
      const goalType = userData.goal || null;
      const tdee = userData.tdee ? parseFloat(userData.tdee) : null;

      // 檢查 TDEE 基本信息（步驟 3）
      const hasTDEEBasicInfo = !!(
        age !== null && age !== undefined &&
        gender !== null && gender !== undefined &&
        height !== null && height !== undefined &&
        weight !== null && weight !== undefined
      );

      // 檢查 TDEE 完整設置（步驟 4）
      hasTDEEComplete = !!(
        hasTDEEBasicInfo && 
        activityLevel && 
        goalType && 
        tdee
      );

      // 檢查角色選擇（步驟 7）
      // 注意：'client' 在 DB 儲存為 'USER'（與預設值相同），無法透過 role 欄位區分「已選 client」與「未選」
      // 因此改以 hasTDEEComplete 作為完成依據：完成 TDEE（含 activityLevel + goal）即代表已走過步驟 7
      // COACH 選擇仍可正確辨識（role = 'COACH'）
      hasRole = !!(userRole === 'COACH' || hasTDEEComplete);

      // 註冊完成 = 完成完整的 TDEE 設置（涵蓋步驟 3、4，並隱含已通過步驟 7）
      registrationComplete = hasTDEEComplete;

      // 下一步驟
      if (!hasTDEEBasicInfo) {
        nextStep = 3;
      } else if (!hasTDEEComplete) {
        nextStep = 4;
      } else {
        nextStep = null;
      }

      console.log('[GET /auth/me] ✅ Registration check:', {
        userId,
        hasTDEEBasicInfo,
        hasTDEEComplete,
        hasRole,
        registrationComplete,
        nextStep,
      });

    } catch (queryError: any) {
      console.error('[GET /auth/me] ❌ Database query error:', queryError);
      return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch user from database');
    }

    // 直接使用資料庫中的原始 role 值
    const userRole = user.role || 'USER';

    console.log('[GET /auth/me] ✅ User found:', {
      id: user.id, email: user.email, dbRole: user.role, registrationComplete
    });

    // ✅ JWT 有效且用戶存在時一律回 200，帶註冊狀態 flag；僅無 token/驗證失敗/用戶不存在時回 401
    const responseData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar || null,
      role: userRole,           // 直接返回資料庫原始值
      createdAt: user.createdAt,
      registrationComplete,
      hasTDEEComplete,
      hasRole,
      nextStep,
    };

    console.log('[GET /auth/me] ✅ Responding with:', responseData);
    console.log('[GET /auth/me] ===== END =====');
    res.status(200).json(responseData);
  } catch (error) {
    console.error('[GET /auth/me] ❌ Error fetching user:', error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch user');
  }
});

// ==========================================
// POST /auth/refresh - 刷新 Token
// ==========================================
router.post('/auth/refresh', async (req: any, res: any) => {
  try {
    const refreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;

    if (!refreshToken) {
      return sendError(res, 401, ErrorCodes.VALIDATION_ERROR, 'Refresh token required');
    }

    // 驗證 refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch (verifyErr: any) {
      clearRefreshCookie(res);
      if (verifyErr.name === 'TokenExpiredError') {
        return sendError(res, 401, ErrorCodes.AUTH_TOKEN_EXPIRED, 'Refresh token expired');
      }
      if (verifyErr.name === 'JsonWebTokenError') {
        return sendError(res, 401, ErrorCodes.AUTH_TOKEN_INVALID, 'Invalid refresh token');
      }
      throw verifyErr;
    }

    const userId = decoded.sub;
    if (!userId) {
      clearRefreshCookie(res);
      return sendError(res, 401, ErrorCodes.AUTH_TOKEN_INVALID, 'Invalid refresh token');
    }

    // 從數據庫查詢用戶（確保用戶仍然存在）
    const user = await getUserById(userId);

    if (!user) {
      clearRefreshCookie(res);
      return sendError(res, 401, ErrorCodes.AUTH_USER_NOT_FOUND, 'User not found');
    }

    const dbTv = tokenVersionOf(user);
    const refreshTv = typeof decoded.tv === 'number' ? decoded.tv : 0;
    if (refreshTv !== dbTv) {
      clearRefreshCookie(res);
      return sendError(res, 401, ErrorCodes.AUTH_TOKEN_INVALID, 'Refresh token revoked');
    }

    // 生成新的 access token
    const userRole = normalizeRoleToUpperCase(user.role);
    const newAccessToken = generateAccessToken({
      sub: String(user.id),
      email: user.email || '',
      role: userRole,
      tv: dbTv,
    });

    const newRefreshToken = generateRefreshToken(String(user.id), dbTv);
    setRefreshCookie(res, newRefreshToken);

    console.log(`[AUTH] Token refreshed for user ${user.id} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      token: newAccessToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 天（秒為單位）
    });
  } catch (error) {
    console.error('[POST /auth/refresh] Error:', error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Token refresh failed');
  }
});

// ==========================================
// POST /auth/logout - 登出
// ==========================================
router.post('/auth/logout', async (req: any, res: any) => {
  try {
    let userId: string | undefined;

    const refreshFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];
    if (refreshFromCookie) {
      const decoded = jwt.decode(refreshFromCookie) as { sub?: string } | null;
      userId = decoded?.sub;
    }
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const decoded = jwt.decode(authHeader.slice(7)) as { sub?: string } | null;
        userId = decoded?.sub;
      }
    }

    // 1) 清理 Passport session user 綁定（若存在）
    if (typeof req.logout === 'function') {
      await new Promise<void>((resolve) => {
        req.logout((logoutErr: Error | null) => {
          if (logoutErr) {
            console.error('[logout] req.logout failed:', logoutErr);
          }
          resolve();
        });
      });
    }

    // 2) 清理 server-side session（若存在）
    if (req.session) {
      await new Promise<void>((resolve) => {
        req.session.destroy((destroyErr: Error | null) => {
          if (destroyErr) {
            console.error('[logout] session destroy failed:', destroyErr);
          }
          resolve();
        });
      });
    }

    // 3) 清理 session cookie（屬性需與 getSession 設定對齊）
    res.clearCookie('connect.sid', {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'lax',
      path: '/',
    });

    clearRefreshCookie(res);

    if (userId) {
      try {
        await bumpUserTokenVersion(userId);
      } catch (bumpErr) {
        console.error('[logout] tokenVersion bump failed:', bumpErr);
      }
    }

    // 4) JWT 無狀態語意維持不變：前端仍需清 access token
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    return res.status(500).json({ success: false, error: 'Failed to logout' });
  }
});

// ==========================================
// GET /auth/verify-email/:token - 驗證郵箱
// ==========================================
router.get('/auth/verify-email/:token', async (req: any, res: any) => {
  try {
    const { token } = req.params;

    if (!token) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'Verification token is required');
    }

    // ✅ 使用 SHA256 哈希 token 後在資料庫中查找
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // 查詢用戶通過 emailVerificationToken（使用哈希後的 token）
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
        emailVerificationToken: users.emailVerificationToken,
        emailVerificationExpires: users.emailVerificationExpires,
      })
      .from(users)
      .where(eq(users.emailVerificationToken, hashedToken))
      .limit(1);

    if (!user) {
      return res.status(404).json({ 
        error: 'Invalid or expired verification token' 
      });
    }

    // ✅ 驗證 token 是否過期
    const now = Date.now();
    if (user.emailVerificationExpires && user.emailVerificationExpires < now) {
      const clientUrl = config.app.clientUrl || config.app.appUrl || 'http://localhost:5173';
      return res.redirect(`${clientUrl}/auth/login?error=token_expired`);
    }

    // 檢查是否已經驗證過
    if (user.emailVerified) {
      const clientUrl = config.app.clientUrl || config.app.appUrl || 'http://localhost:5173';
      return res.redirect(`${clientUrl}/auth/login?verified=true`);
    }

    // 更新用戶：emailVerified = true，清除 token 和過期時間
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    console.log('[GET /auth/verify-email] Email verified:', user.email);

    // 重定向到登錄頁面
    const clientUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/auth/login?verified=true`);
  } catch (error) {
    console.error('[GET /auth/verify-email] Error:', error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to verify email');
  }
});

// ==========================================
// GET /api/v1/auth/verify-email/:token - API 版本（返回 JSON）
// 注意：因為 authRoutes 已經通過 app.use("/api", authRoutes) 註冊，
// 所以這裡的路由定義不需要包含 /api 前綴
// ==========================================
router.get('/v1/auth/verify-email/:token', async (req: any, res: any) => {
  try {
    const { token } = req.params;

    console.log('[GET /api/v1/auth/verify-email] ===== START =====');
    console.log('[GET /api/v1/auth/verify-email] Token:', token);
    console.log('[GET /api/v1/auth/verify-email] Token length:', token?.length);
    console.log('[GET /api/v1/auth/verify-email] Request URL:', req.originalUrl);
    console.log('[GET /api/v1/auth/verify-email] Request path:', req.path);

    if (!token) {
      console.log('[GET /api/v1/auth/verify-email] ❌ Token is missing');
      return res.status(400).json({ 
        success: false,
        error: 'Verification token is required' 
      });
    }

    console.log('[GET /api/v1/auth/verify-email] Looking for user with token...');

    // ✅ 使用 SHA256 哈希 token 後在資料庫中查找
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    console.log('[GET /api/v1/auth/verify-email] Hashed token:', hashedToken.substring(0, 16) + '...');

    // 查詢用戶通過 emailVerificationToken（使用哈希後的 token）
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
        emailVerificationToken: users.emailVerificationToken,
        emailVerificationExpires: users.emailVerificationExpires,
      })
      .from(users)
      .where(eq(users.emailVerificationToken, hashedToken))
      .limit(1);

    console.log('[GET /api/v1/auth/verify-email] Query result:', {
      found: !!user,
      userId: user?.id,
      email: user?.email,
      emailVerified: user?.emailVerified,
      expiresAt: user?.emailVerificationExpires ? new Date(user.emailVerificationExpires).toISOString() : null,
    });

    if (!user) {
      console.log('[GET /api/v1/auth/verify-email] ❌ User not found with hashed token');
      return res.status(404).json({ 
        success: false,
        error: 'Invalid or expired verification token' 
      });
    }

    // ✅ 驗證 token 是否過期
    const now = Date.now();
    if (user.emailVerificationExpires && user.emailVerificationExpires < now) {
      console.log('[GET /api/v1/auth/verify-email] ❌ Token expired:', {
        expiresAt: new Date(user.emailVerificationExpires).toISOString(),
        now: new Date(now).toISOString(),
        expiredBy: Math.floor((now - user.emailVerificationExpires) / 1000 / 60) + ' minutes',
      });
      return res.status(400).json({ 
        success: false,
        error: 'Verification token has expired. Please request a new verification email.' 
      });
    }

    // 檢查是否已經驗證過
    if (user.emailVerified) {
      console.log('[GET /api/v1/auth/verify-email] ✅ Email already verified:', user.email);
      return res.json({ 
        success: true,
        message: 'Email already verified',
        alreadyVerified: true
      });
    }

    console.log('[GET /api/v1/auth/verify-email] Updating user emailVerified status...');

    // 更新用戶：emailVerified = true，清除 token 和過期時間
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    console.log('[GET /api/v1/auth/verify-email] ✅ Email verified successfully:', user.email);
    console.log('[GET /api/v1/auth/verify-email] ===== END =====');

    res.json({ 
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('[GET /api/v1/auth/verify-email] Error:', error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to verify email');
  }
});

// ==========================================
// POST /api/v1/auth/resend-verification - 重新發送驗證郵件
// ==========================================
router.post('/v1/auth/resend-verification', async (req: any, res: any) => {
  try {
    const { email } = req.body;

    console.log('[POST /api/v1/auth/resend-verification] ===== START =====');
    console.log('[POST /api/v1/auth/resend-verification] Email:', email);

    // ✅ 驗證 email 參數
    if (!email || typeof email !== 'string') {
      console.log('[POST /api/v1/auth/resend-verification] ❌ Email is missing or invalid');
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ✅ 檢查用戶是否存在
    const user = await getUserByEmail(normalizedEmail);

    if (!user) {
      console.log('[POST /api/v1/auth/resend-verification] ❌ User not found:', normalizedEmail);
      // 為了安全，不透露用戶是否存在，返回成功消息
      return res.json({
        success: true,
        message: '如果該郵箱已註冊，驗證郵件已發送',
      });
    }

    console.log('[POST /api/v1/auth/resend-verification] User found:', {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    });

    // ✅ 檢查用戶是否已驗證
    if (user.emailVerified) {
      console.log('[POST /api/v1/auth/resend-verification] ❌ Email already verified:', normalizedEmail);
      return res.status(400).json({
        success: false,
        error: '郵箱已驗證',
      });
    }

    // ✅ 生成新的驗證 token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 小時後

    console.log('[POST /api/v1/auth/resend-verification] Generated new token:', {
      rawTokenLength: rawToken.length,
      hashedTokenLength: hashedToken.length,
      expiresAt: new Date(expiresAt).toISOString(),
    });

    // ✅ 更新資料庫
    await db
      .update(users)
      .set({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    console.log('[POST /api/v1/auth/resend-verification] Database updated successfully');

    // ✅ 發送驗證郵件（使用未加密的原始 token）
    try {
      await emailService.sendVerificationEmail(normalizedEmail, rawToken);
      console.log('[POST /api/v1/auth/resend-verification] ✅ Verification email sent:', normalizedEmail);
    } catch (emailError) {
      console.error('[POST /api/v1/auth/resend-verification] ❌ Failed to send email:', emailError);
      // 即使郵件發送失敗，也返回成功（token 已更新）
      // 但記錄錯誤以便排查
    }

    console.log('[POST /api/v1/auth/resend-verification] ===== END =====');

    res.json({
      success: true,
      message: '驗證郵件已重新發送',
    });
  } catch (error) {
    console.error('[POST /api/v1/auth/resend-verification] ❌ Error:', error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to resend verification email');
  }
});

// ==========================================
// GET /api/v1/auth/check-email-verified - 檢查郵箱驗證狀態
// ==========================================
router.get('/v1/auth/check-email-verified', async (req: any, res: any) => {
  try {
    const { email } = req.query;

    console.log('[GET /api/v1/auth/check-email-verified] ===== START =====');
    console.log('[GET /api/v1/auth/check-email-verified] Query params:', req.query);
    console.log('[GET /api/v1/auth/check-email-verified] Email:', email);

    // ✅ 驗證 email 參數是否存在
    if (!email || typeof email !== 'string') {
      console.log('[GET /api/v1/auth/check-email-verified] ❌ Email parameter is missing or invalid');
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log('[GET /api/v1/auth/check-email-verified] Normalized email:', normalizedEmail);

    // ✅ 使用 getUserByEmail(email) 查找用戶
    console.log('[GET /api/v1/auth/check-email-verified] Looking for user...');
    const user = await getUserByEmail(normalizedEmail);

    // ✅ 如果用戶不存在，返回 404
    if (!user) {
      console.log('[GET /api/v1/auth/check-email-verified] ❌ User not found:', normalizedEmail);
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    console.log('[GET /api/v1/auth/check-email-verified] ✅ User found:', {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    });

    // ✅ 返回用戶的驗證狀態（包含 email 字段）
    const response = {
      success: true,
      emailVerified: user.emailVerified || false,
      email: user.email || normalizedEmail,
    };

    console.log('[GET /api/v1/auth/check-email-verified] ✅ Response:', response);
    console.log('[GET /api/v1/auth/check-email-verified] ===== END =====');

    res.json(response);
  } catch (error) {
    console.error('[GET /api/v1/auth/check-email-verified] ❌ Error:', error);
    console.error('[GET /api/v1/auth/check-email-verified] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to check email verification status');
  }
});

// ==========================================
// 管理端點（開發測試用，無身份驗證）
// ==========================================

// GET /api/v1/admin/users - 列出所有用戶
router.get('/v1/admin/users', async (req: any, res: any) => {
  try {
    console.log('[GET /api/v1/admin/users] 查詢所有用戶...');

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        avatar: users.avatar,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(users.createdAt);

    console.log(`[GET /api/v1/admin/users] ✅ 找到 ${allUsers.length} 個用戶`);

    res.json({
      success: true,
      count: allUsers.length,
      users: allUsers,
    });
  } catch (error) {
    console.error('[GET /api/v1/admin/users] ❌ 錯誤:', error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch users');
  }
});

// DELETE /api/v1/admin/users/:id - 刪除用戶
router.delete('/v1/admin/users/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;

    console.log('[DELETE /api/v1/admin/users/:id] 刪除用戶:', id);

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // 先查詢用戶是否存在
    const user = await getUserById(id);
    if (!user) {
      console.log('[DELETE /api/v1/admin/users/:id] ❌ 用戶不存在:', id);
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // 刪除用戶
    await db
      .delete(users)
      .where(eq(users.id, id));

    console.log('[DELETE /api/v1/admin/users/:id] ✅ 用戶已刪除:', {
      id,
      email: user.email,
    });

    res.json({
      success: true,
      message: 'User deleted successfully',
      deletedUser: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('[DELETE /api/v1/admin/users/:id] ❌ 錯誤:', error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete user');
  }
});

// ==========================================
// POST /auth/google/callback - Google OAuth 回調
// ==========================================
router.post('/auth/google/callback', async (req: any, res: any) => {
  try {
    const { code, clientId, flow } = req.body; // ← 添加 flow 參數

    console.log('[POST /auth/google/callback] ===== START =====');
    console.log('[POST /auth/google/callback] flow:', flow, 'code length:', code?.length);
    console.log('[POST /auth/google/callback] Client ID:', clientId);

    // ==========================================
    // 步驟 1：驗證參數
    // ==========================================
    if (!code) {
      console.log('[POST /auth/google/callback] ❌ Authorization code is missing');
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      });
    }

    // ==========================================
    // 步驟 2：使用 authorization code 交換 token
    // ==========================================
    console.log('[POST /auth/google/callback] Exchanging code for tokens...');
    console.log('[POST /auth/google/callback] Config:', {
      clientId: googleConfig.clientId ? 'SET' : 'MISSING',
      clientSecret: googleConfig.clientSecret ? 'SET' : 'MISSING',
      redirectUri: googleConfig.redirectUri,
    });

    // ✅ Google OAuth API 要求使用 application/x-www-form-urlencoded 格式
    // ✅ redirect_uri 必須與前端 @react-oauth/google 使用的完全一致
    // 默認情況下，@react-oauth/google 使用當前頁面的 origin（如 http://localhost:5173）
    const redirectUri = googleConfig.redirectUri || config.app.clientUrl || config.app.appUrl || 'http://localhost:5173';
    
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', googleConfig.clientId || clientId || '');
    params.append('client_secret', googleConfig.clientSecret || '');
    params.append('redirect_uri', redirectUri);
    params.append('grant_type', 'authorization_code');
    
    console.log('[POST /auth/google/callback] Token exchange params:', {
      codeLength: code?.length,
      clientId: googleConfig.clientId ? 'SET' : 'MISSING',
      clientSecret: googleConfig.clientSecret ? 'SET' : 'MISSING',
      redirectUri: redirectUri,
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      console.error('[POST /auth/google/callback] ❌ Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorData,
      });
      return res.status(400).json({
        success: false,
        error: 'Failed to exchange authorization code',
        details: errorData,
      });
    }

    const tokens = await tokenResponse.json();
    console.log('[POST /auth/google/callback] ✅ Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasIdToken: !!tokens.id_token,
    });

    // ==========================================
    // 步驟 3：使用 access token 獲取用戶信息
    // ==========================================
    console.log('[POST /auth/google/callback] Fetching user info...');

    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    if (!userInfoResponse.ok) {
      console.error('[POST /auth/google/callback] ❌ Failed to fetch user info');
      return res.status(400).json({
        success: false,
        error: 'Failed to fetch user information',
      });
    }

    const googleUser = await userInfoResponse.json();
    console.log('[POST /auth/google/callback] ✅ Google user info received:', {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
    });

    // ==========================================
    // 步驟 4：檢查或創建本地用戶
    // ==========================================
    const normalizedEmail = googleUser.email.toLowerCase();
    let user = await getUserByEmail(normalizedEmail);
    
    // ✅ 標記是否為新用戶（在創建用戶之前記錄）
    const isNewUser = !user;

    console.log('[POST /auth/google/callback] 🔍 User check:', {
      email: normalizedEmail,
      flow: flow,
      userFound: !!user,
      isNewUser: isNewUser,
    });

    // 如果在「登入頁面」但用戶不存在，直接返回錯誤（在創建用戶之前）
    if (flow === 'login' && isNewUser) {
      console.log('[POST /auth/google/callback] ⚠️ User does not exist in login flow');
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: '你的帳戶並未註冊，請先註冊',
        email: googleUser.email,
      });
    }

    // 如果在「註冊頁面」但用戶已存在，直接返回錯誤（在創建用戶之前）
    if (flow === 'register' && !isNewUser && user) {
      console.log('[POST /auth/google/callback] ⚠️ User already exists in register flow');
      return res.status(409).json({
        success: false,
        error: 'USER_ALREADY_EXISTS',
        message: '你的帳戶已註冊，請使用登入功能',
        email: user.email,
      });
    }

    if (!user) {
      console.log('[POST /auth/google/callback] 👤 Creating new user...');

      // 從 Google name 提取 firstName 和 lastName
      const [firstName, ...lastNameParts] = (googleUser.name || 'Google User').split(
        ' '
      );
      const lastName = lastNameParts.join(' ');

      await createUser({
        email: normalizedEmail,
        firstName: firstName || 'Google',
        lastName: lastName || 'User',
        passwordHash: crypto.randomBytes(32).toString('hex'), // 隨機密碼（Google OAuth 不需要）
        role: 'USER',
        emailVerified: true, // Google 已驗證 email
        emailVerificationToken: null,
        emailVerificationExpires: null,
      });

      // 重新獲取用戶以確保獲取完整信息
      user = await getUserByEmail(normalizedEmail);
      console.log('[POST /auth/google/callback] ✅ New user created, isNewUser should be true:', isNewUser);

      // 如果 Google 提供了頭像，更新用戶頭像
      if (googleUser.picture && user) {
        await db
          .update(users)
          .set({
            avatar: googleUser.picture,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
        user = { ...user, avatar: googleUser.picture };
      }

      console.log('[POST /auth/google/callback] ✅ New user created:', {
        id: user?.id,
        email: user?.email,
      });
    } else {
      console.log('[POST /auth/google/callback] 👤 Existing user found, isNewUser should be false:', isNewUser);
      console.log('[POST /auth/google/callback] ✅ Existing user found:', {
        id: user.id,
        email: user.email,
      });

      // 如果用戶還沒驗證郵箱，通過 Google OAuth 自動驗證
      if (!user.emailVerified) {
        console.log('[POST /auth/google/callback] Marking email as verified...');
        await db
          .update(users)
          .set({
            emailVerified: true,
            emailVerificationToken: null,
            emailVerificationExpires: null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        user = { ...user, emailVerified: true };
      }

      // 如果 Google 提供了頭像且用戶沒有頭像，更新頭像
      if (googleUser.picture && !user.avatar) {
        await db
          .update(users)
          .set({
            avatar: googleUser.picture,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
        user = { ...user, avatar: googleUser.picture };
      }
    }

    // ==========================================
    // 步驟 5：驗證用戶已創建
    // ==========================================
    if (!user) {
      console.error('[POST /auth/google/callback] ❌ User creation failed');
      return res.status(500).json({
        success: false,
        error: 'Failed to create or retrieve user',
      });
    }

    // ==========================================
    // 步驟 6：生成 JWT tokens
    // ==========================================
    console.log('[POST /auth/google/callback] Generating JWT tokens...');

    const userRole = normalizeRoleToUpperCase(user.role);
    const tv = tokenVersionOf(user);

    const accessToken = generateAccessToken({
      sub: String(user.id), // ✅ 轉換為字符串
      email: user.email || '',
      role: userRole,
      tv,
    });

    const refreshToken = generateRefreshToken(String(user.id), tv); // ✅ 轉換為字符串

    console.log('[POST /auth/google/callback] ✅ Tokens generated');
    console.log('[POST /auth/google/callback] ===== END =====');

    setRefreshCookie(res, refreshToken);

    // ==========================================
    // 步驟 6：返回響應
    // ==========================================
    
    console.log('[POST /auth/google/callback] 📤 Returning response with:', {
      isNewUser: isNewUser,
      flow: flow,
      userId: user?.id,
      email: user?.email,
    });
    
    res.json({
      success: true,
      message: 'Google authentication successful',
      token: accessToken,
      isNewUser: isNewUser, // ✅ 標記是否為新用戶
      flow: flow, // ← 返回 flow 供前端使用
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        avatar: user.avatar || null,
        role: userRole,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt || null,
      },
    });
  } catch (error) {
    console.error('[POST /auth/google/callback] ❌ Error:', error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Google authentication failed');
  }
});

// ==========================================
// GET /auth/registration-status - 檢查註冊完成狀態
// ==========================================
router.get('/auth/registration-status', verifyJWT, async (req: any, res: any) => {
  try {
    // ✅ 使用與 verifyJWT 相同的方式獲取用戶ID
    const userId = req.user?.id || req.user?.claims?.sub || req.user?.sub;
    
    if (!userId) {
      console.log('[GET /auth/registration-status] ❌ User ID not found in req.user:', req.user);
      return res.status(401).json({
        success: false,
        error: 'User ID not found',
      });
    }

    console.log('[GET /auth/registration-status] Checking registration status for user:', userId);

    // 查詢 users 表實際存在的欄位（與 server/db/schema.ts 對齊）
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, age, gender, height, weight, activity_level, goal, tdee
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    // ✅ 如果用戶不存在，返回 incomplete 而不是 404
    if (result.rows.length === 0) {
      console.log('[GET /auth/registration-status] ⚠️ User not found in database, returning incomplete status');
      return res.json({
        success: true,
        data: {
          registrationStatus: 'incomplete',
          nextStep: 1,
          completedSteps: {
            step1: false,
            step2: false,
            step3: false,
            step4: false,
            step5: false,
            step6: false,
            step7: false,
          },
        },
      });
    }

    const userData = result.rows[0];
    const userRole = userData.role;
    const age = userData.age;
    const gender = userData.gender;
    const height = userData.height ? parseFloat(userData.height) : null;
    const weight = userData.weight ? parseFloat(userData.weight) : null;
    const activityLevel = userData.activity_level || null;
    const goalType = userData.goal || null;
    const tdee = userData.tdee ? parseFloat(userData.tdee) : null;

    // 步驟 1: 用戶名（OAuth 用戶已有，可視為完成）
    // 步驟 2: Email/Password（OAuth 用戶已跳過，視為完成）
    // 步驟 3: TDEE 基本信息（年齡、性別、身高、體重）
    // 步驟 4: TDEE 完整設置（活動水平、目標）
    // 步驟 5: Newsletter（可選）
    // 步驟 6: Sync Contacts（可選）
    // 步驟 7: 角色選擇

    // 檢查 TDEE 基本信息（步驟 3）
    const hasTDEEBasicInfo = !!(
      age !== null && 
      age !== undefined &&
      gender !== null && 
      gender !== undefined &&
      height !== null && 
      height !== undefined &&
      weight !== null && 
      weight !== undefined
    );

    // 檢查 TDEE 完整設置（步驟 4）
    const hasTDEEComplete = !!(
      hasTDEEBasicInfo && 
      activityLevel && 
      goalType && 
      tdee
    );

    // 角色選擇（步驟 7）
    // 'client' 在 DB 儲存為 'USER'（與預設值相同），以 hasTDEEComplete 作為完成依據
    const hasRole = userRole === 'COACH' || hasTDEEComplete;

    let registrationStatus: 'incomplete' | 'partial' | 'complete';
    let nextStep: number | null = null;

    if (!hasTDEEBasicInfo) {
      registrationStatus = 'partial';
      nextStep = 3;
    } else if (!hasTDEEComplete) {
      registrationStatus = 'partial';
      nextStep = 4;
    } else {
      registrationStatus = 'complete';
      nextStep = null;
    }

    console.log('[GET /auth/registration-status] ✅ Registration status check:', {
      userId,
      hasTDEEBasicInfo,
      hasTDEEComplete,
      hasRole,
      registrationStatus,
      nextStep,
    });

    res.json({
      success: true,
      data: {
        registrationStatus,
        nextStep,
        completedSteps: {
          step1: true, // OAuth 用戶跳過
          step2: true, // OAuth 用戶跳過
          step3: hasTDEEBasicInfo,
          step4: hasTDEEComplete,
          step5: true, // 可選
          step6: true, // 可選
          step7: hasRole, // 角色選擇
        },
      },
    });
  } catch (error: any) {
    console.error('[GET /auth/registration-status] ❌ Error:', error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to check registration status');
  }
});

export default router;
