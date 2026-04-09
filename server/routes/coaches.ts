import { Router } from 'express';
import { db, pool } from '../db';
import { users, coachClients } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyJWT } from '../replitAuth';

const router = Router();

// ✅ 1. 添加學生 - 教練通過學生郵箱添加
router.post('/coaches/add-client', verifyJWT, async (req: any, res: any) => {
  try {
    const { clientEmail } = req.body;
    const coachId = req.user?.claims?.sub || req.user?.id;

    if (!coachId) return res.status(401).json({ error: 'Not authenticated' });
    if (!clientEmail) return res.status(400).json({ error: 'Client email required' });

    const clientResult = await db
      .select()
      .from(users)
      .where(eq(users.email, clientEmail))
      .limit(1);

    const client = clientResult[0];
    if (!client) return res.status(404).json({ error: 'User not found' });
    if (client.id === coachId) return res.status(400).json({ error: 'Cannot add yourself as client' });

    const existing = await db
      .select()
      .from(coachClients)
      .where(and(eq(coachClients.coachId, coachId), eq(coachClients.clientId, client.id)))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Client already added', status: existing[0].status });
    }

    const newRecord = await db
      .insert(coachClients)
      .values({ coachId, clientId: client.id, status: 'active' })
      .returning();

    res.json({ success: true, newCoachClient: newRecord[0] });
  } catch (error) {
    console.error('❌ [coaches] Error adding client:', error);
    res.status(500).json({ error: 'Failed to add client' });
  }
});

// ✅ 1b. 邀請客戶（別名）
router.post('/coaches/invite', verifyJWT, async (req: any, res: any) => {
  try {
    const { email } = req.body;
    const coachId = req.user?.claims?.sub || req.user?.id;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    const clientResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const client = clientResult[0];

    if (!client) return res.status(404).json({ error: 'User not found' });
    if (client.id === coachId) return res.status(400).json({ error: 'Cannot invite yourself' });

    const existing = await db
      .select()
      .from(coachClients)
      .where(and(eq(coachClients.coachId, coachId), eq(coachClients.clientId, client.id)))
      .limit(1);

    if (existing.length > 0) {
      const st = existing[0].status;
      if (st === 'active') return res.status(400).json({ error: 'Already connected with this client' });
      return res.status(400).json({ error: 'Invitation already sent' });
    }

    const newRecord = await db
      .insert(coachClients)
      .values({ coachId, clientId: client.id, status: 'active' })
      .returning();

    res.status(201).json({ message: 'Invitation sent successfully', success: true, newCoachClient: newRecord[0] });
  } catch (error) {
    console.error('❌ [coaches] Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// ✅ 2. 獲取教練的學生列表
router.get('/coaches/clients', verifyJWT, async (req: any, res: any) => {
  try {
    const coachId = req.user?.claims?.sub || req.user?.id;
    if (!coachId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await pool.query(
      `SELECT
        u.id,
        u.email,
        u.first_name  AS "firstName",
        u.last_name   AS "lastName",
        u.role,
        u.avatar,
        u.created_at,
        cc.id         AS "relationshipId",
        cc.client_id  AS "clientId",
        cc.coach_id   AS "coachId",
        cc.status,
        cc.start_date AS "startDate",
        cc.created_at AS "relationshipCreatedAt",
        cc.notes
       FROM users u
       JOIN coach_clients cc ON u.id = cc.client_id
       WHERE cc.coach_id = $1 AND cc.status = 'active'`,
      [coachId]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('❌ [coaches] Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients', message: error?.message });
  }
});

// ✅ 3. 獲取特定學生詳情
router.get('/coaches/clients/:clientId', verifyJWT, async (req: any, res: any) => {
  try {
    const { clientId } = req.params;
    const coachId = req.user?.claims?.sub || req.user?.id;
    if (!coachId) return res.status(401).json({ error: 'Not authenticated' });

    const relationship = await db
      .select()
      .from(coachClients)
      .where(and(eq(coachClients.coachId, coachId), eq(coachClients.clientId, clientId)))
      .limit(1);

    if (relationship.length === 0) return res.status(403).json({ error: 'Not authorized' });

    const clientResult = await db.select().from(users).where(eq(users.id, clientId)).limit(1);

    res.json({ ...relationship[0], client: clientResult[0] });
  } catch (error) {
    console.error('❌ [coaches] Error fetching client:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// ✅ 4. 移除學生（POST）
router.post('/coaches/remove-client', verifyJWT, async (req: any, res: any) => {
  try {
    const { clientId } = req.body;
    const coachId = req.user?.claims?.sub || req.user?.id;
    if (!coachId) return res.status(401).json({ error: 'Not authenticated' });
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const result = await db
      .delete(coachClients)
      .where(and(eq(coachClients.coachId, coachId), eq(coachClients.clientId, clientId)))
      .returning();

    if (result.length === 0) return res.status(404).json({ error: 'Client relationship not found' });

    res.json({ success: true, message: 'Client removed' });
  } catch (error) {
    console.error('❌ [coaches] Error removing client:', error);
    res.status(500).json({ error: 'Failed to remove client' });
  }
});

// ✅ 4b. 移除學生（DELETE RESTful）
router.delete('/coaches/clients/:clientId', verifyJWT, async (req: any, res: any) => {
  try {
    const { clientId } = req.params;
    const coachId = req.user?.claims?.sub || req.user?.id;
    if (!coachId) return res.status(401).json({ error: 'Not authenticated' });

    const result = await db
      .delete(coachClients)
      .where(and(eq(coachClients.coachId, coachId), eq(coachClients.clientId, clientId)))
      .returning();

    if (result.length === 0) return res.status(404).json({ error: 'Client relationship not found' });

    res.json({ success: true, message: 'Client removed successfully' });
  } catch (error) {
    console.error('❌ [coaches] Error removing client:', error);
    res.status(500).json({ error: 'Failed to remove client' });
  }
});

// ✅ 5. 更新學生狀態
router.put('/coaches/clients/:clientId', verifyJWT, async (req: any, res: any) => {
  try {
    const { clientId } = req.params;
    const { status, notes } = req.body;
    const coachId = req.user?.claims?.sub || req.user?.id;
    if (!coachId) return res.status(401).json({ error: 'Not authenticated' });

    const validStatuses = ['active', 'paused', 'completed'];
    if (status && !validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const updateData: any = {};
    if (status) updateData.status = status.toLowerCase();
    if (notes !== undefined) updateData.notes = notes || null;

    const result = await db
      .update(coachClients)
      .set(updateData)
      .where(and(eq(coachClients.coachId, coachId), eq(coachClients.clientId, clientId)))
      .returning();

    if (result.length === 0) return res.status(404).json({ error: 'Relationship not found' });

    res.json({ success: true, result: result[0] });
  } catch (error) {
    console.error('❌ [coaches] Error updating client status:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

export default router;
