/**
 * FitBuddy 認證系統 - TypeScript 類型定義
 */

export type UserRole = 'USER' | 'COACH' | 'BOTH' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  phone?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastActive?: Date;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    avatar?: string;
    firstName?: string;
    lastName?: string;
  };
  token?: string;
  refreshToken?: string;
}

export interface SelectRoleRequest {
  userId?: string;
  role: UserRole;
}

export interface SelectRoleResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
  };
  token: string;
  message: string;
}

// 權限檢查函式
export function isCoach(user: { role: UserRole }): boolean {
  return user.role === 'COACH' || user.role === 'BOTH';
}

export function isClient(user: { role: UserRole }): boolean {
  return user.role === 'USER' || user.role === 'BOTH';
}

export function isAdmin(user: { role: UserRole }): boolean {
  return user.role === 'ADMIN';
}

export function hasRole(user: { role: UserRole }, roles: UserRole[]): boolean {
  return roles.includes(user.role);
}

export function isValidRole(role: string): role is UserRole {
  return ['USER', 'COACH', 'BOTH', 'ADMIN'].includes(role);
}

export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    USER: '用戶',
    COACH: '教練',
    BOTH: '用戶 & 教練',
    ADMIN: '管理員',
  };
  return roleNames[role];
}

export function normalizeRole(role: string): UserRole {
  const normalized = role.toUpperCase();
  if (isValidRole(normalized)) {
    return normalized;
  }
  return 'USER';
}

