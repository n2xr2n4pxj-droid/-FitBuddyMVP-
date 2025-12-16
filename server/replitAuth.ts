import type { Express, RequestHandler } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import { db, pool } from "./db";
import { users, type User } from "@shared/schema";
import { eq } from "drizzle-orm";

// --- Local email/password auth for development ---

export function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt ?? crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, actualSalt, 10000, 64, "sha512")
    .toString("hex");
  return `${actualSalt}:${hash}`;
}

export function verifyPassword(password: string, stored?: string | null): boolean {
  if (!stored) {
    console.log("[verifyPassword] No stored password hash provided");
    return false;
  }
  
  // 檢查格式：應該是 "salt:hash"
  if (!stored.includes(":")) {
    console.log("[verifyPassword] Invalid password hash format (missing colon)");
    return false;
  }
  
  const [salt, hash] = stored.split(":");
  
  if (!salt || !hash) {
    console.log("[verifyPassword] Invalid password hash format (missing salt or hash)");
    return false;
  }
  
  const hashToVerify = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  
  const isValid = hashToVerify === hash;
  console.log("[verifyPassword] Verification details:", {
    saltLength: salt.length,
    hashLength: hash.length,
    hashToVerifyLength: hashToVerify.length,
    isValid,
  });
  
  return isValid;
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  return session({
    secret: process.env.SESSION_SECRET || "dev-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // 本機開發用，HTTP 也能帶 cookie
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

function sanitizeUser(user: User) {
  // 去掉敏感欄位（例如 passwordHash），避免送到前端
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safeUser } = user as any;
  return safeUser;
}

export async function setupAuth(app: Express) {
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      // 使用原始 SQL 查詢，避免 Drizzle schema 檢查問題
      // 包含 role 字段以支持教練系統
      const result = await pool.query(
        `SELECT id, email, password_hash, first_name, last_name, role, created_at, updated_at FROM "User" WHERE id = $1 LIMIT 1`,
        [id]
      );
      
      const user = result.rows[0] ? {
        id: result.rows[0].id,
        email: result.rows[0].email,
        passwordHash: result.rows[0].password_hash,
        firstName: result.rows[0].first_name,
        lastName: result.rows[0].last_name,
        role: result.rows[0].role, // 包含 role 字段
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      } : null;
      if (!user) {
        console.log("[DeserializeUser] User not found for id:", id);
        return done(null, false);
      }
      return done(null, user);
    } catch (error) {
      console.error("[DeserializeUser] Error:", error);
      return done(error as Error);
    }
  });

  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
        session: true,
      },
      async (email, password, done) => {
        try {
          if (!email || typeof email !== "string" || email.trim() === "") {
            console.log("[LocalStrategy] Invalid email provided");
            return done(null, false, { message: "Email is required" });
          }
          
          console.log("[LocalStrategy] Attempting login for email:", email);
          
          // 標準化 email（轉小寫並去除空格）
          const normalizedEmail = email.trim().toLowerCase();
          console.log("[LocalStrategy] Normalized email:", normalizedEmail);
          
          // 使用原始 SQL 查詢，避免 Drizzle schema 檢查問題
          console.log("[LocalStrategy] Executing SQL query for email:", normalizedEmail);
          const result = await pool.query(
            `SELECT id, email, password_hash, first_name, last_name, created_at, updated_at FROM "User" WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
            [normalizedEmail]
          );
          
          console.log("[LocalStrategy] Query result:", {
            rowCount: result.rowCount,
            hasRows: result.rows.length > 0,
            firstRowKeys: result.rows[0] ? Object.keys(result.rows[0]) : null,
            firstRowEmail: result.rows[0]?.email || null,
          });
          
          // 如果查詢沒有結果，檢查數據庫中的所有用戶
          if (!result.rows || result.rows.length === 0) {
            console.log("[LocalStrategy] No user found for email:", normalizedEmail);
            // 調試：檢查數據庫中的所有用戶 email
            const allUsersResult = await pool.query(
              `SELECT id, email, LOWER(TRIM(email)) as normalized_email FROM "User" LIMIT 10`
            );
            console.log("[LocalStrategy] All users in database:", allUsersResult.rows.map(r => ({
              id: r.id,
              email: r.email,
              normalized: r.normalized_email
            })));
            return done(null, false, { message: "Invalid email or password" });
          }
          
          const user = result.rows[0] ? {
            id: result.rows[0].id,
            email: result.rows[0].email,
            passwordHash: result.rows[0].password_hash,
            firstName: result.rows[0].first_name,
            lastName: result.rows[0].last_name,
            createdAt: result.rows[0].created_at,
            updatedAt: result.rows[0].updated_at,
          } : null;
          
          if (!user) {
            console.log("[LocalStrategy] User object is null after parsing");
            return done(null, false, { message: "Invalid email or password" });
          }
          
          console.log("[LocalStrategy] User found:", {
            id: user.id,
            email: user.email,
            hasPasswordHash: !!user.passwordHash,
          });
          
          console.log("[LocalStrategy] User found, verifying password...");
          const passwordHash = (user as any).passwordHash;
          
          if (!passwordHash) {
            console.log("[LocalStrategy] User has no password hash");
            return done(null, false, { message: "Invalid email or password" });
          }
          
          // 調試：記錄 password_hash 的格式（只顯示前 20 個字符）
          console.log("[LocalStrategy] Password hash format check:", {
            hasColon: passwordHash.includes(":"),
            hashLength: passwordHash.length,
            hashPrefix: passwordHash.substring(0, 20) + "...",
          });
          
          const passwordValid = verifyPassword(password, passwordHash);
          
          console.log("[LocalStrategy] Password verification result:", passwordValid);
          
          if (!passwordValid) {
            console.log("[LocalStrategy] Password verification failed");
            return done(null, false, { message: "Invalid email or password" });
    }
          
          console.log("[LocalStrategy] Login successful for user:", user.id);
          return done(null, user);
        } catch (error: any) {
          console.error("[LocalStrategy] Error during login:", error);
          console.error("[LocalStrategy] Error stack:", error?.stack);
          console.error("[LocalStrategy] Error message:", error?.message);
          return done(error as Error);
        }
      }
    )
  );

  // 註冊：建立帳號並自動登入
  app.post("/api/auth/register", async (req, res) => {
    try {
      console.log("[Register] Request received:", { body: req.body });
      const { email, password, firstName, lastName } = req.body ?? {};

      if (!email || typeof email !== "string") {
        console.log("[Register] Email validation failed");
        return res.status(400).json({ message: "Email is required" });
      }
      if (!password || typeof password !== "string" || password.length < 6) {
        console.log("[Register] Password validation failed");
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters" });
      }

      // 標準化 email（轉小寫並去除空格）
      const normalizedEmail = email.trim().toLowerCase();
      console.log("[Register] Normalized email:", normalizedEmail);
      
      console.log("[Register] Checking for existing user...");
      // 使用原始 SQL 查詢檢查用戶是否存在
      const existingResult = await pool.query(
        `SELECT id FROM "User" WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
        [normalizedEmail]
      );
      
      if (existingResult.rows.length > 0) {
        console.log("[Register] Email already exists");
        return res.status(400).json({ message: "Email already registered" });
      }

      console.log("[Register] Creating password hash...");
      const passwordHash = hashPassword(password);

      console.log("[Register] Inserting new user...");
      // 使用原始 SQL 查詢插入用戶，避免 Drizzle schema 檢查問題
      const insertSql = `INSERT INTO "User" (email, "passwordHash", "firstName", "lastName", role) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, email, "passwordHash", "firstName", "lastName", role`;
      console.log("[Register] SQL query:", insertSql);
      console.log("[Register] SQL parameters:", {
        email: normalizedEmail,
        passwordHash: passwordHash ? `${passwordHash.substring(0, 20)}...` : 'null',
        firstName: firstName || null,
        lastName: lastName || null,
        role: 'client',
      });
      
      const insertResult = await pool.query(
        insertSql,
        [normalizedEmail, passwordHash, firstName || null, lastName || null, 'client']
      );

      if (!insertResult.rows || insertResult.rows.length === 0) {
        console.error("[Register] Failed to create user - no user returned");
        return res.status(500).json({ message: "Failed to create user" });
      }
      
      const newUser = {
        id: insertResult.rows[0].id,
        email: insertResult.rows[0].email,
        passwordHash: insertResult.rows[0].passwordHash,
        firstName: insertResult.rows[0].firstName,
        lastName: insertResult.rows[0].lastName,
        role: insertResult.rows[0].role || 'client',
      };

      console.log("[Register] User created successfully, establishing session...");
      req.login(newUser as any, (err) => {
        if (err) {
          console.error("[Register] Session establishment error:", err);
          return res
            .status(500)
            .json({ message: "Failed to establish session after register" });
        }
        console.log("[Register] Registration successful");
        // 生成 JWT token
        const token = generateJWT({
          id: newUser.id,
          email: newUser.email,
          role: newUser.role || 'client',
        });
        return res.status(201).json({ 
          user: sanitizeUser(newUser as any),
          token 
        });
      });
    } catch (error: any) {
      console.error("[Register] Error:", error);
      console.error("[Register] Error stack:", error?.stack);
      console.error("[Register] Error message:", error?.message);
      return res.status(500).json({ 
        message: "Failed to register user",
        error: error?.message || String(error)
      });
    }
  });

  // 登入：使用 passport-local
  app.post("/api/auth/login", (req, res, next) => {
    try {
      console.log("[Login] Request received:", { 
        email: req.body?.email,
        hasPassword: !!req.body?.password,
        bodyKeys: Object.keys(req.body || {})
      });
      
      if (!req.body || !req.body.email || !req.body.password) {
        console.log("[Login] Missing email or password in request");
        return res.status(400).json({ 
          message: "Email and password are required" 
        });
      }
      
      passport.authenticate("local", (err: Error | null, user: User | false, info?: { message?: string }) => {
      if (err) {
          console.error("[Login] Authentication error:", err);
          console.error("[Login] Error stack:", err?.stack);
          console.error("[Login] Error name:", err?.name);
          return res.status(500).json({ 
            message: "Login failed",
            error: err?.message || String(err)
          });
      }
      if (!user) {
          console.log("[Login] Authentication failed:", info?.message);
        return res
          .status(401)
          .json({ message: info?.message || "Invalid credentials" });
      }
        console.log("[Login] Authentication successful, establishing session...");
      req.logIn(user, (loginErr) => {
        if (loginErr) {
            console.error("[Login] Session establishment error:", loginErr);
            console.error("[Login] Session error stack:", (loginErr as any)?.stack);
          return res
            .status(500)
              .json({ 
                message: "Failed to establish session",
                error: (loginErr as any)?.message || String(loginErr)
              });
        }
          console.log("[Login] Login successful");
        // 生成 JWT token
        if (!user.email) {
          return res.status(500).json({ 
            message: "User email is missing",
          });
        }
        const token = generateJWT({
          id: user.id,
          email: user.email,
          role: (user as any).role || 'client',
        });
        return res.json({ 
          user: sanitizeUser(user as User),
          token 
        });
      });
    })(req, res, next);
    } catch (error: any) {
      console.error("[Login] Unexpected error:", error);
      console.error("[Login] Error stack:", error?.stack);
      return res.status(500).json({ 
        message: "Unexpected error during login",
        error: error?.message || String(error)
      });
    }
  });

  // 登出：清除 session
  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.json({ success: true });
      });
    });
  });
}

// JWT Secret - 從環境變量獲取，默認使用開發密鑰
const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-in-production";

// 🔧 生成 JWT Token
export function generateJWT(user: { id: string; email: string; role?: string }): string {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role || 'client',
  };
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d', // 7 天過期
  });
}

// 🔧 驗證 JWT Token 中間件（支持 Bearer token 和 Session 混合）
export const verifyJWT: RequestHandler = async (req: any, res, next) => {
  try {
    // 1. 優先檢查 Session 認證（向後兼容）
    if (req.isAuthenticated && req.isAuthenticated()) {
      // Session 認證成功，設置 req.user（如果還沒有）
      if (!req.user && req.session?.passport?.user) {
        // 從 session 中恢復用戶信息
        const userId = req.session.passport.user;
        const result = await pool.query(
          `SELECT id, email, first_name, last_name, role FROM "User" WHERE id = $1 LIMIT 1`,
          [userId]
        );
        if (result.rows.length > 0) {
          req.user = {
            id: result.rows[0].id,
            email: result.rows[0].email,
            firstName: result.rows[0].first_name,
            lastName: result.rows[0].last_name,
            role: result.rows[0].role,
            claims: {
              sub: result.rows[0].id,
              email: result.rows[0].email,
              role: result.rows[0].role,
            },
          };
        }
      }
      return next();
    }

    // 2. 檢查 Bearer Token（JWT）
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // 移除 "Bearer " 前綴
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        // 從數據庫獲取用戶信息以確保用戶仍然存在
        const result = await pool.query(
          `SELECT id, email, first_name, last_name, role FROM "User" WHERE id = $1 LIMIT 1`,
          [decoded.sub]
        );
        
        if (result.rows.length === 0) {
          return res.status(401).json({ message: "User not found" });
        }
        
        // 設置 req.user 以統一格式
        req.user = {
          id: result.rows[0].id,
          email: result.rows[0].email,
          firstName: result.rows[0].first_name,
          lastName: result.rows[0].last_name,
          role: result.rows[0].role,
          claims: {
            sub: result.rows[0].id,
            email: result.rows[0].email,
            role: result.rows[0].role,
          },
        };
        
        return next();
      } catch (jwtError: any) {
        console.log("[verifyJWT] JWT verification failed:", jwtError.message);
        return res.status(401).json({ message: "Invalid or expired token" });
      }
    }

    // 3. 兩種認證方式都失敗
    return res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    console.error("[verifyJWT] Error:", error);
    return res.status(500).json({ message: "Authentication error" });
  }
};

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
