import { Router } from 'express';
import { db, pool } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, isAuthenticated, verifyJWT } from '../replitAuth';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { 
  getUserById, 
  getUserByEmail, 
  updateUserRole,
  createUser 
} from '../db/queries';
import emailService from '../services/emailService';

const router = Router();

// ==========================================
// JWT 常量
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-key';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-token-secret-key';
const ACCESS_TOKEN_EXPIRATION = '7d';
const REFRESH_TOKEN_EXPIRATION = '30d';

// ==========================================
// Google OAuth 配置
// ==========================================
const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_CALLBACK_URL,
};

// ==========================================
// Token 生成輔助函數
// ==========================================
interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

const generateAccessToken = (payload: TokenPayload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRATION,
  });
};

const generateRefreshToken = (userId: string) => {
  return jwt.sign({ sub: userId }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRATION,
  });
};

// ==========================================
// 角色工具函數
// ==========================================

/**
 * 標準化角色為大寫值
 * - 支援舊系統 'coach' / 'client'
 * - 新系統使用 'USER' | 'COACH' | 'BOTH' | 'ADMIN'
 */
function normalizeRoleToUpperCase(role?: string | null): 'USER' | 'COACH' | 'BOTH' | 'ADMIN' {
  if (!role) return 'USER';

  const r = role.toString().toUpperCase();

  // 舊系統小寫兼容
  if (r === 'COACH') return 'COACH';
  if (r === 'CLIENT') return 'USER';

  if (r === 'USER' || r === 'COACH' || r === 'BOTH' || r === 'ADMIN') {
    return r as 'USER' | 'COACH' | 'BOTH' | 'ADMIN';
  }

  return 'USER';
}

// 驗證角色是否有效（接受小寫和大寫）
function isValidRole(role: any): boolean {
  if (!role) return false;
  const r = role.toString().toLowerCase();
  return ['client', 'coach', 'both', 'admin', 'user'].includes(r);
}

// ==========================================
// POST /auth/register - 用戶註冊
// ==========================================
router.post('/auth/register',  async (req: any, res: any) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    console.log('[POST /auth/register]', { email, firstName, lastName, role });

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = hashPassword(password);

    // 標準化角色為小寫（資料庫使用小寫）
    let normalizedRole = 'client';
    if (role && isValidRole(role)) {
      normalizedRole = role.toString().toLowerCase();
      // 將 'user' 轉換為 'client'
      if (normalizedRole === 'user') normalizedRole = 'client';
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
      firstName,
      lastName,
      role: normalizedRole,
      emailVerificationToken: hashedToken, // ✅ 保存哈希後的 token
      emailVerified: false,
      emailVerificationExpires: expiresAt, // ✅ 保存過期時間
    });

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
    const userRole = newUser.role || 'client';

    console.log('[POST /auth/register] Success - user created, email verification required:', { 
      id: newUser.id, 
      email: newUser.email,
      role: userRole 
    });

    // ✅ 不返回 token，要求用戶先驗證郵箱
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email before logging in.',
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
    res.status(500).json({
      message: 'Failed to register user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
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
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await getUserByEmail(email);

    if (!user) {
      console.log('[POST /auth/login] User not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.passwordHash) {
      console.log('[POST /auth/login] User has no password hash:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const passwordValid = verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      console.log('[POST /auth/login] Invalid password for:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ✅ 檢查郵箱是否已驗證
    if (!user.emailVerified) {
      console.log('[POST /auth/login] ❌ Email not verified for:', email);
      return res.status(403).json({ 
        error: '請先驗證你的郵箱',
        needsVerification: true 
      });
    }

    // 直接使用資料庫中的原始 role 值（'client', 'coach' 等）
    const userRole = user.role || 'client';

    // 生成 tokens
    const accessToken = generateAccessToken({
      sub: String(user.id),
      email: user.email || '',
      role: userRole,
    });

    const refreshToken = generateRefreshToken(String(user.id));

    console.log('[POST /auth/login] Success:', { id: user.id, role: userRole });

    const { passwordHash, ...safeUser } = user as any;

    res.json({
      success: true,
      message: 'Login successful',
      token: accessToken,
      refreshToken,
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
    res.status(500).json({
      message: 'Failed to login',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
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
        error: "Invalid role. Must be 'client', 'coach', 'both', or 'admin'"
      });
    }

    // 標準化為小寫（資料庫使用小寫）
    const normalizedRole = role.toString().toLowerCase();

    console.log('[SelectRole] ✅ Validation passed', { userId, normalizedRole });

    const updatedUser = await updateUserRole(userId, normalizedRole);

    if (!updatedUser) {
      console.log('[SelectRole] ❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // 使用資料庫中實際存儲的 role 值
    const userRole = updatedUser.role || 'client';

    console.log('[SelectRole] ✅ Database updated:', { id: updatedUser.id, role: userRole });

    // 生成新的 tokens（包含更新後的角色）
    const accessToken = generateAccessToken({
      sub: String(updatedUser.id),
      email: updatedUser.email || '',
      role: userRole,
    });

    const refreshToken = generateRefreshToken(String(updatedUser.id));

    const response = {
      success: true,
      message: 'Role selected successfully',
      token: accessToken,
      refreshToken,
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
    return res.status(500).json({
      error: 'Failed to select role',
      message: error instanceof Error ? error.message : String(error)
    });
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
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret-key');
      console.log('[GET /auth/me] ✅ Token verified');
    } catch (verifyErr) {
      console.error('[GET /auth/me] ❌ Token verification failed:', verifyErr);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = decoded.sub;
    console.log('[GET /auth/me] Decoded userId:', userId);

    if (!userId) {
      console.log('[GET /auth/me] ❌ No userId found in token');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log('[GET /auth/me] Looking up user by id...');
    const user = await getUserById(userId);

    if (!user) {
      console.log('[GET /auth/me] ❌ User not found in database:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // 直接使用資料庫中的原始 role 值
    const userRole = user.role || 'client';

    console.log('[GET /auth/me] ✅ User found:', {
      id: user.id, email: user.email, dbRole: user.role
    });

    const { passwordHash, profileImageUrl, ...safeUser } = user as any;

    const responseData = {
      id: safeUser.id,
      email: safeUser.email,
      firstName: safeUser.firstName,
      lastName: safeUser.lastName,
      avatar: profileImageUrl || null,  // 將 profileImageUrl 映射為 avatar
      role: userRole,           // 直接返回資料庫原始值
      createdAt: safeUser.createdAt,
    };

    console.log('[GET /auth/me] ✅ Responding with:', responseData);
    console.log('[GET /auth/me] ===== END =====');
    res.json(responseData);
  } catch (error) {
    console.error('[GET /auth/me] ❌ Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ==========================================
// POST /auth/refresh - 刷新 Token
// ==========================================
router.post('/auth/refresh', async (req: any, res: any) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // 驗證 refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch (verifyErr: any) {
      if (verifyErr.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Refresh token expired' });
      }
      if (verifyErr.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }
      throw verifyErr;
    }

    const userId = decoded.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // 從數據庫查詢用戶（確保用戶仍然存在）
    const user = await getUserById(userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // 生成新的 access token
    const userRole = user.role || 'client';
    const newAccessToken = generateAccessToken({
      sub: String(user.id),
      email: user.email || '',
      role: userRole,
    });

    // 企業級：可選的 Refresh Token Rotation（增強安全性）
    // 生成新的 refresh token（舊的自動失效）
    const newRefreshToken = generateRefreshToken(String(user.id));

    console.log(`[AUTH] Token refreshed for user ${user.id} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken, // 企業級：返回新的 refresh token
      expiresIn: 7 * 24 * 60 * 60, // 7 天（秒為單位）
    });
  } catch (error) {
    console.error('[POST /auth/refresh] Error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ==========================================
// POST /auth/logout - 登出
// ==========================================
router.post('/auth/logout', async (req: any, res: any) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // JWT 無狀態，登出只需前端清 token
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// ==========================================
// GET /auth/verify-email/:token - 驗證郵箱
// ==========================================
router.get('/auth/verify-email/:token', async (req: any, res: any) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
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
      const clientUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:5173';
      return res.redirect(`${clientUrl}/auth/login?error=token_expired`);
    }

    // 檢查是否已經驗證過
    if (user.emailVerified) {
      const clientUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:5173';
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
    res.status(500).json({ 
      error: 'Failed to verify email',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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
    res.status(500).json({ 
      success: false,
      error: 'Failed to verify email',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification email',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
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
    res.status(500).json({
      success: false,
      error: 'Failed to check email verification status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
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
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
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
      .where(eq(users.id, parseInt(id, 10)));

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
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ==========================================
// POST /auth/google/callback - Google OAuth 回調
// ==========================================
router.post('/auth/google/callback', async (req: any, res: any) => {
  try {
    const { code, clientId } = req.body;

    console.log('[POST /auth/google/callback] ===== START =====');
    console.log('[POST /auth/google/callback] Code received, length:', code?.length);
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
    const redirectUri = googleConfig.redirectUri || `${process.env.CLIENT_URL || 'http://localhost:5173'}`;
    
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

    if (!user) {
      console.log('[POST /auth/google/callback] 👤 New user, creating account...');

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
        role: 'client',
        emailVerified: true, // Google 已驗證 email
        emailVerificationToken: null,
        emailVerificationExpires: null,
      });

      // 重新獲取用戶以確保獲取完整信息
      user = await getUserByEmail(normalizedEmail);

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

    const userRole = user.role || 'client';

    const accessToken = generateAccessToken({
      sub: String(user.id), // ✅ 轉換為字符串
      email: user.email || '',
      role: userRole,
    });

    const refreshToken = generateRefreshToken(String(user.id)); // ✅ 轉換為字符串

    console.log('[POST /auth/google/callback] ✅ Tokens generated');
    console.log('[POST /auth/google/callback] ===== END =====');

    // ==========================================
    // 步驟 6：返回響應
    // ==========================================
    res.json({
      success: true,
      message: 'Google authentication successful',
      token: accessToken,
      refreshToken,
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
    res.status(500).json({
      success: false,
      error: 'Google authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
