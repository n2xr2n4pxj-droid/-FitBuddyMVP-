/**
 * 教練/學員關係列表 API（基於 coach_clients 表，UUID）
 *
 * GET /api/coach/clients  - 教練端：我的 active 學員列表
 * GET /api/client/coaches - 學員端：我的 active 教練列表
 */

import { Router } from 'express';
import { db } from '../db';
import { coachClients, users } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { verifyJWT } from '../replitAuth';
import { getUserById } from '../db/queries';
import { assertCanAccessTargetUser } from '../lib/coachAccess';
import { getDayNutritionPayload, hktDayBoundsUtc } from '../services/nutritionDay';

const router = Router();

/**
 * GET /coach/clients
 * 教練端：查詢 coach_clients 中 coachId = 當前用戶且 status = 'active'，Join users 回傳學員 id, firstName, lastName, email, avatar。
 * 認證：JWT，角色須為 COACH / ADMIN。
 */
router.get('/coach/clients', verifyJWT, async (req: any, res: any) => {
  try {
    const currentId = req.user?.id ?? req.user?.claims?.sub;
    if (!currentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const currentUser = await getUserById(currentId);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }
    const role = String(currentUser.role ?? '').toUpperCase();
    if (role !== 'COACH' && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only coach can list clients' });
    }

    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
      })
      .from(coachClients)
      .innerJoin(users, eq(coachClients.clientId, users.id))
      .where(
        and(
          eq(coachClients.coachId, String(currentId)),
          eq(coachClients.status, 'active')
        )
      );

    return res.status(200).json(rows);
  } catch (error: any) {
    console.error('❌ [API] GET /coach/clients Error:', error);
    return res.status(500).json({ error: error?.message ?? 'Failed to fetch clients' });
  }
});

/**
 * GET /coach-client/my-learners
 * TRAINER 端：回傳教練名下 learner 清單（預設含 active/inactive 狀態）
 * 認證：JWT，角色須為 COACH / ADMIN。
 */
router.get('/coach-client/my-learners', verifyJWT, async (req: any, res: any) => {
  try {
    const currentId = req.user?.id ?? req.user?.claims?.sub;
    if (!currentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const currentUser = await getUserById(currentId);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }
    const role = String(currentUser.role ?? '').toUpperCase();
    if (role !== 'COACH' && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only trainer can list learners' });
    }

    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
        status: coachClients.status,
      })
      .from(coachClients)
      .innerJoin(users, eq(coachClients.clientId, users.id))
      .where(eq(coachClients.coachId, String(currentId)))
      .orderBy(desc(coachClients.createdAt));

    const learners = rows.map((row) => {
      const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.email;
      const avatarFallback = (name[0] || row.email[0] || '?').toUpperCase();
      return {
        id: row.id,
        name,
        avatarUrl: row.avatar ?? undefined,
        avatarFallback,
        status: row.status === 'active' ? 'active' : 'inactive',
      };
    });

    return res.status(200).json(learners);
  } catch (error: any) {
    console.error('❌ [API] GET /coach-client/my-learners Error:', error);
    return res.status(500).json({ error: error?.message ?? 'Failed to fetch learners' });
  }
});

/**
 * GET /client/coaches
 * 學員端：查詢 coach_clients 中 clientId = 當前用戶且 status = 'active'，Join users 回傳教練 id, firstName, lastName, email, avatar。
 * 認證：JWT。
 */
router.get('/client/coaches', verifyJWT, async (req: any, res: any) => {
  try {
    const currentId = req.user?.id ?? req.user?.claims?.sub;
    if (!currentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const currentUser = await getUserById(currentId);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
      })
      .from(coachClients)
      .innerJoin(users, eq(coachClients.coachId, users.id))
      .where(
        and(
          eq(coachClients.clientId, String(currentId)),
          eq(coachClients.status, 'active')
        )
      );

    return res.status(200).json(rows);
  } catch (error: any) {
    console.error('❌ [API] GET /client/coaches Error:', error);
    return res.status(500).json({ error: error?.message ?? 'Failed to fetch coaches' });
  }
});

/**
 * GET /coach-client/my-coach
 * 學員端：回傳單一「目前指派教練」摘要（若無則 null）
 * 回傳：{ assignedCoachId: string | null, assignedCoach: {...} | null }
 */
router.get('/coach-client/my-coach', verifyJWT, async (req: any, res: any) => {
  try {
    const currentId = req.user?.id ?? req.user?.claims?.sub;
    if (!currentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const currentUser = await getUserById(currentId);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
      })
      .from(coachClients)
      .innerJoin(users, eq(coachClients.coachId, users.id))
      .where(
        and(
          eq(coachClients.clientId, String(currentId)),
          eq(coachClients.status, 'active')
        )
      )
      .orderBy(desc(coachClients.createdAt))
      .limit(1);

    const assignedCoach = rows[0] ?? null;
    return res.status(200).json({
      assignedCoachId: assignedCoach?.id ?? null,
      assignedCoach,
    });
  } catch (error: any) {
    console.error('❌ [API] GET /coach-client/my-coach Error:', error);
    return res.status(500).json({ error: error?.message ?? 'Failed to fetch assigned coach' });
  }
});

/**
 * GET /coach/clients/:clientId/nutrition/logs?date=YYYY-MM-DD
 * 教練檢視學員當日飲食（active coach_clients）；回傳 logs + summary + goals（學員 users 目標值）。
 */
router.get('/coach/clients/:clientId/nutrition/logs', verifyJWT, async (req: any, res: any) => {
  try {
    const actorId = String(req.user?.id ?? req.user?.claims?.sub ?? '').trim();
    if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
    const actor = await getUserById(actorId);
    if (!actor) return res.status(401).json({ error: 'Unauthorized' });

    const clientId = String(req.params?.clientId ?? '').trim();
    if (!clientId) return res.status(400).json({ error: 'Missing clientId' });

    const ok = await assertCanAccessTargetUser(actorId, actor.role, clientId);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });

    const dateYmd = String(req.query?.date ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
      return res.status(400).json({ error: 'Invalid or missing date (YYYY-MM-DD)' });
    }
    try {
      hktDayBoundsUtc(dateYmd);
    } catch {
      return res.status(400).json({ error: 'Invalid date' });
    }

    const payload = await getDayNutritionPayload(clientId, dateYmd);
    return res.status(200).json(payload);
  } catch (error: any) {
    console.error('❌ [API] GET /coach/clients/:clientId/nutrition/logs Error:', error);
    return res.status(500).json({ error: error?.message ?? 'Failed to fetch client nutrition' });
  }
});

export default router;
