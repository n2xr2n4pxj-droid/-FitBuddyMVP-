import { db } from '../db';
import { users } from './schema';
import { eq, inArray, sql } from 'drizzle-orm';

// 將輸入角色標準化為資料庫儲存格式（大寫，匹配 roleEnum）
const normalizeRoleInput = (role?: string | null): "USER" | "COACH" | "ADMIN" => {
  if (!role) return 'USER';
  const r = role.toString().toUpperCase();
  // 支援舊的小寫值轉換
  if (r === 'CLIENT') return 'USER';
  if (r === 'USER' || r === 'COACH' || r === 'ADMIN') {
    return r as "USER" | "COACH" | "ADMIN";
  }
  // 舊資料兼容：BOTH 已廢棄，統一提升為 COACH
  if (r === 'BOTH') {
    return 'COACH';
  }
  return 'USER';
};

// 將資料庫角色標準化為業務判斷格式（大寫）
const normalizeRoleValue = (role?: string | null): 'USER' | 'COACH' | 'ADMIN' | null => {
  if (!role) return null;
  const r = role.toString().toUpperCase();
  if (r === 'CLIENT') return 'USER';
  if (r === 'USER' || r === 'COACH' || r === 'ADMIN') {
    return r as 'USER' | 'COACH' | 'ADMIN';
  }
  // 舊資料兼容：BOTH 已廢棄，統一提升為 COACH
  if (r === 'BOTH') {
    return 'COACH';
  }
  return null;
};

// 按 ID 獲取用戶（使用 UUID / varchar）
export async function getUserById(userId: string | number) {
  const queryId = String(userId);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      avatar: users.avatar,
      createdAt: users.createdAt,
      tokenVersion: users.tokenVersion,
    })
    .from(users)
    .where(eq(users.id, queryId))
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

// 按郵箱獲取用戶
export async function getUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      avatar: users.avatar,
      emailVerified: users.emailVerified, // ✅ 添加 emailVerified 字段
      createdAt: users.createdAt,
      tokenVersion: users.tokenVersion,
    })
    .from(users)
    .where(sql`LOWER(TRIM(${users.email})) = ${normalizedEmail}`)
    .limit(1);
  return rows.length > 0 ? rows[0] : null;
}

// 更新用戶角色（UUID / varchar）
export async function updateUserRole(userId: string, role: string) {
  const queryId = String(userId);
  const normalizedRole = normalizeRoleInput(role);
  const rows = await db
    .update(users)
    .set({
      role: normalizedRole,
      updatedAt: sql`NOW()`,
    })
    .where(eq(users.id, queryId))
    .returning({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      avatar: users.avatar,
      createdAt: users.createdAt,
      tokenVersion: users.tokenVersion,
    });
  return rows.length > 0 ? rows[0] : null;
}

// 驗證用戶是否為教練
export async function isUserCoach(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  const role = normalizeRoleValue(user.role);
  return role === 'COACH';
}

// 驗證用戶是否為客戶
export async function isUserClient(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  const role = normalizeRoleValue(user.role);
  return role === 'USER';
}

// 創建新用戶
export async function createUser(data: {
  email: string;
  passwordHash: string;
  username?: string | null;
  firstName?: string;
  lastName?: string;
  role?: string; // 接受任何字符串，內部會標準化
  emailVerificationToken?: string | null;
  emailVerified?: boolean;
  emailVerificationExpires?: number | null; // BIGINT 時間戳（毫秒）
}) {
  const normalizedEmail = data.email.trim().toLowerCase();
  const usernameTrimmed =
    typeof data.username === "string" && data.username.trim()
      ? data.username.trim()
      : null;
  const rows = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      passwordHash: data.passwordHash,
      username: usernameTrimmed,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      role: normalizeRoleInput(data.role) as "USER" | "COACH" | "ADMIN",
      emailVerificationToken: data.emailVerificationToken || null,
      emailVerified: data.emailVerified !== undefined ? data.emailVerified : false,
      emailVerificationExpires: data.emailVerificationExpires || null,
    })
    .returning({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      avatar: users.avatar,
      createdAt: users.createdAt,
    });

  return rows.length > 0 ? rows[0] : null;
}

// 依角色列表獲取用戶（支持 USER / COACH / ADMIN）
export async function getUsersByRoles(roles: Array<'USER' | 'COACH' | 'ADMIN'>) {
  // 使用 inArray 來匹配角色
  return db
    .select()
    .from(users)
    .where(inArray(users.role, roles));
}

// 取得教練列表
export async function getAllCoaches() {
  return getUsersByRoles(['COACH']);
}

