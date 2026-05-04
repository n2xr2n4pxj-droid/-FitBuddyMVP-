/**
 * Users API - 需 JWT，admin 或本人可看
 * GET /api/users - 列表（name, email, role）
 * GET /api/users/:id - 單個用戶詳情
 */

import { Router, Request, Response } from 'express';
import { verifyJWT } from '../replitAuth';
import { db } from '../db';
import { users } from '../db/schema';
import { getUserById } from '../db/queries';
import { sendError } from '../lib/response';
import { ErrorCodes } from '@shared/error-codes';

const router = Router();

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type UserDetail = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  avatar: string | null;
  createdAt: Date | null;
};

function getCurrentUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.claims?.sub ?? user?.id ?? null;
}

function toName(firstName: string | null, lastName: string | null, email: string): string {
  const parts = [firstName, lastName].filter(Boolean).join(' ').trim();
  return parts || email || '';
}

/**
 * GET /users
 * 需 JWT。admin 可看全部，否則只回傳自己。
 */
router.get('/users', verifyJWT, async (req: Request, res: Response) => {
  try {
    const currentId = getCurrentUserId(req);
    if (!currentId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const currentUser = await getUserById(currentId);
    if (!currentUser) {
      return sendError(res, 401, ErrorCodes.AUTH_USER_NOT_FOUND, 'User not found');
    }

    const role = String(currentUser.role || '').toUpperCase();
    const isAdmin = role === 'ADMIN';

    if (isAdmin) {
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
        })
        .from(users);

      const list: UserListItem[] = rows.map((r) => ({
        id: String(r.id),
        name: toName(r.firstName ?? null, r.lastName ?? null, r.email),
        email: r.email,
        role: String(r.role ?? 'USER'),
      }));
      return res.status(200).json(list);
    }

    const self: UserListItem[] = [
      {
        id: String(currentUser.id),
        name: toName(currentUser.firstName ?? null, currentUser.lastName ?? null, currentUser.email),
        email: currentUser.email,
        role: String(currentUser.role ?? 'USER'),
      },
    ];
    return res.status(200).json(self);
  } catch (error: unknown) {
    console.error('[GET /api/users] Error:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
});

/**
 * GET /users/:id
 * 需 JWT。admin 或本人可看。
 */
router.get('/users/:id', verifyJWT, async (req: Request, res: Response) => {
  try {
    const currentId = getCurrentUserId(req);
    if (!currentId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const currentUser = await getUserById(currentId);
    if (!currentUser) {
      return sendError(res, 401, ErrorCodes.AUTH_USER_NOT_FOUND, 'User not found');
    }

    const role = String(currentUser.role || '').toUpperCase();
    const isAdmin = role === 'ADMIN';
    const targetId = req.params.id;

    if (!isAdmin && String(currentId) !== String(targetId)) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, 'Forbidden');
    }

    const target = await getUserById(targetId);
    if (!target) {
      return sendError(res, 404, ErrorCodes.NOT_FOUND, 'User not found');
    }

    const detail: UserDetail = {
      id: String(target.id),
      email: target.email,
      firstName: target.firstName ?? null,
      lastName: target.lastName ?? null,
      role: String(target.role ?? 'USER'),
      avatar: target.avatar ?? null,
      createdAt: target.createdAt ?? null,
    };
    return res.status(200).json(detail);
  } catch (error: unknown) {
    console.error('[GET /api/users/:id] Error:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
});

export default router;
