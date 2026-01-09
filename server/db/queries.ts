import { db } from '../db';
import { users } from './schema';
import { eq, inArray, sql } from 'drizzle-orm';

// 將輸入角色標準化為資料庫儲存格式（大寫，匹配 roleEnum）
const normalizeRoleInput = (role?: string | null): "USER" | "COACH" | "BOTH" | "ADMIN" => {
  if (!role) return 'USER';
  const r = role.toString().toUpperCase();
  // 支援舊的小寫值轉換
  if (r === 'CLIENT') return 'USER';
  if (r === 'USER' || r === 'COACH' || r === 'BOTH' || r === 'ADMIN') {
    return r as "USER" | "COACH" | "BOTH" | "ADMIN";
  }
  return 'USER';
};

// 將資料庫角色標準化為業務判斷格式（大寫）
const normalizeRoleValue = (role?: string | null): 'USER' | 'COACH' | 'BOTH' | 'ADMIN' | null => {
  if (!role) return null;
  const r = role.toString().toUpperCase();
  if (r === 'CLIENT') return 'USER';
  if (r === 'USER' || r === 'COACH' || r === 'BOTH' || r === 'ADMIN') {
    return r as 'USER' | 'COACH' | 'BOTH' | 'ADMIN';
  }
  return null;
};

// 按 ID 獲取用戶
export async function getUserById(userId: string | number) {
  const userIdNum = typeof userId === 'number' ? userId : parseInt(userId, 10);
  if (isNaN(userIdNum)) {
    return null;
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      avatar: users.avatar,
      createdAt: users.createdAt,
      // 使用 avatar 字段，包含 createdAt
    })
    .from(users)
    .where(eq(users.id, userIdNum))
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
    })
    .from(users)
    .where(sql`LOWER(TRIM(${users.email})) = ${normalizedEmail}`)
    .limit(1);
  return rows.length > 0 ? rows[0] : null;
}

// 更新用戶角色
export async function updateUserRole(userId: string, role: string) {
  const userIdNum = typeof userId === 'number' ? userId : parseInt(userId, 10);
  if (isNaN(userIdNum)) {
    return null;
  }
  const normalizedRole = normalizeRoleInput(role);
  const rows = await db
    .update(users)
    .set({
      role: normalizedRole,
      updatedAt: sql`NOW()`,
    })
    .where(eq(users.id, userIdNum))
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

// 驗證用戶是否為教練
export async function isUserCoach(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  const role = normalizeRoleValue(user.role);
  return role === 'COACH' || role === 'BOTH';
}

// 驗證用戶是否為客戶
export async function isUserClient(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  const role = normalizeRoleValue(user.role);
  return role === 'USER' || role === 'BOTH';
}

// 創建新用戶
export async function createUser(data: {
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  role?: string; // 接受任何字符串，內部會標準化
  emailVerificationToken?: string | null;
  emailVerified?: boolean;
  emailVerificationExpires?: number | null; // BIGINT 時間戳（毫秒）
}) {
  const normalizedEmail = data.email.trim().toLowerCase();
  const rows = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      passwordHash: data.passwordHash,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      role: normalizeRoleInput(data.role) as "USER" | "COACH" | "BOTH" | "ADMIN",
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

// 依角色列表獲取用戶（支持 USER / COACH / BOTH / ADMIN）
export async function getUsersByRoles(roles: Array<'USER' | 'COACH' | 'BOTH' | 'ADMIN'>) {
  // 使用 inArray 來匹配角色
  return db
    .select()
    .from(users)
    .where(inArray(users.role, roles));
}

// 取得教練列表（包含 both 視為教練）
export async function getAllCoaches() {
  return getUsersByRoles(['COACH', 'BOTH']);
}

