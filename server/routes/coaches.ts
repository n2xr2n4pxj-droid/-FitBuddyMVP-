import { Router } from 'express';
import { db, pool } from '../db';
import { users, coachClientRelationships } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyJWT } from '../replitAuth';

const router = Router();

// ✅ 1. 添加學生 - 教練通過學生郵箱添加（邀請功能）
router.post('/coaches/add-client', verifyJWT, async (req: any, res: any) => {
  try {
    const { clientEmail } = req.body;
    const coachId = req.user?.claims?.sub || req.user?.id;

    console.log(`🟡 [API] POST /coaches/add-client - coachId: ${coachId}, email: ${clientEmail}`);

    if (!coachId) {
      console.log('❌ [API] No coach ID found');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!clientEmail) {
      console.log('❌ [API] Client email required');
      return res.status(400).json({ error: 'Client email required' });
    }

    // 找到學生用戶
    const clientResult = await db
      .select()
      .from(users)
      .where(eq(users.email, clientEmail))
      .limit(1);

    const client = clientResult[0];

    if (!client) {
      console.log(`❌ [API] User not found with email: ${clientEmail}`);
      return res.status(404).json({ error: 'User not found' });
    }

    if (client.id === coachId) {
      console.log('❌ [API] Cannot add yourself as client');
      return res.status(400).json({ error: 'Cannot add yourself as client' });
    }

    // 檢查是否已添加
    const existingResult = await db
      .select()
      .from(coachClientRelationships)
      .where(
        and(
          eq(coachClientRelationships.coachId, coachId),
          eq(coachClientRelationships.clientId, client.id)
        )
      )
      .limit(1);

    if (existingResult.length > 0) {
      const existingStatus = existingResult[0].status;
      console.log(`⚠️ [API] Client relationship already exists with status: ${existingStatus}`);
      return res.status(400).json({ 
        error: 'Client already added',
        status: existingStatus 
      });
    }

    // 創建關係（使用 ACTIVE 狀態，對應數據庫枚舉值）
    const newCoachClient = await db
      .insert(coachClientRelationships)
      .values({
        coachId,
        clientId: client.id,
        status: 'ACTIVE', // 數據庫枚舉值：'ACTIVE', 'PAUSED', 'TERMINATED'
      })
      .returning();

    console.log(`✅ [API] Client added successfully: ${clientEmail}`);
    res.json({ success: true, newCoachClient: newCoachClient[0] });
  } catch (error) {
    console.error('❌ [API] Error adding client:', error);
    res.status(500).json({ error: 'Failed to add client' });
  }
});

// ✅ 1b. 邀請客戶（別名，與 add-client 功能相同）
router.post('/coaches/invite', verifyJWT, async (req: any, res: any) => {
  try {
    const { email } = req.body;
    const coachId = req.user?.claims?.sub || req.user?.id;

    console.log(`🟡 [API] POST /coaches/invite - coachId: ${coachId}, email: ${email}`);

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // 重定向到 add-client 邏輯
    const { clientEmail } = { clientEmail: email };
    
    // 找到學生用戶
    const clientResult = await db
      .select()
      .from(users)
      .where(eq(users.email, clientEmail))
      .limit(1);

    const client = clientResult[0];

    if (!client) {
      console.log(`❌ [API] User not found with email: ${email}`);
      return res.status(404).json({ error: 'User not found' });
    }

    if (client.id === coachId) {
      return res.status(400).json({ error: 'Cannot invite yourself' });
    }

    // 檢查是否已存在關係
    const existingResult = await db
      .select()
      .from(coachClientRelationships)
      .where(
        and(
          eq(coachClientRelationships.coachId, coachId),
          eq(coachClientRelationships.clientId, client.id)
        )
      )
      .limit(1);

    if (existingResult.length > 0) {
      const existingStatus = existingResult[0].status;
      if (existingStatus === 'ACTIVE') {
        return res.status(400).json({ error: 'Already connected with this client' });
      }
      return res.status(400).json({ error: 'Invitation already sent' });
    }

    // 創建關係（使用 ACTIVE 狀態）
    const newCoachClient = await db
      .insert(coachClientRelationships)
      .values({
        coachId,
        clientId: client.id,
        status: 'ACTIVE', // 數據庫枚舉值
      })
      .returning();

    console.log(`✅ [API] Invitation sent to ${email}`);
    res.status(201).json({ 
      message: 'Invitation sent successfully',
      success: true,
      newCoachClient: newCoachClient[0]
    });
  } catch (error) {
    console.error('❌ [API] Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// ✅ 2. 獲取教練的學生列表
router.get('/coaches/clients', verifyJWT, async (req: any, res: any) => {
  try {
    console.log('🟡 [API] GET /coaches/clients - START');
    console.log('🟡 [API] Request user:', {
      hasUser: !!req.user,
      userId: req.user?.id,
      claimsSub: req.user?.claims?.sub,
      userRole: req.user?.role,
      userEmail: req.user?.email,
    });

    const coachId = req.user?.claims?.sub || req.user?.id;
    
    console.log(`🟡 [API] GET /coaches/clients - coachId: ${coachId}`);

    if (!coachId) {
      console.log('❌ [API] No coach ID found');
      console.log('❌ [API] req.user:', req.user);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ✅ 使用原始 SQL 查詢，確保表名和欄位名正確
    // 查詢該教練的所有客戶（狀態為 ACTIVE 的，對應 accepted）
    // 注意：coach_client_relationships 表的狀態是 'ACTIVE', 'PAUSED', 'TERMINATED'
    console.log('🟡 [API] Executing SQL query with coachId:', coachId);
    
    const result = await pool.query(
      `SELECT 
        u.id, 
        u.email, 
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.role,
        u.avatar,
        u.created_at,
        ccr.id as "relationshipId",
        ccr.client_id as "clientId",
        ccr.coach_id as "coachId",
        ccr.status,
        ccr.start_date as "startDate",
        ccr.created_at as "relationshipCreatedAt",
        ccr.notes
       FROM users u 
       JOIN coach_client_relationships ccr ON u.id = ccr.client_id 
       WHERE ccr.coach_id = $1 AND ccr.status = 'ACTIVE'`,
      [coachId]
    );

    console.log(`✅ [API] Found ${result.rows.length} clients for coach ${coachId}`);
    console.log('✅ [API] Clients data:', result.rows);
    res.json(result.rows);
  } catch (error: any) {
    console.error('❌ [API] Error fetching clients:', error);
    console.error('❌ [API] Error stack:', error?.stack);
    console.error('❌ [API] Error message:', error?.message);
    console.error('❌ [API] Error name:', error?.name);
    console.error('❌ [API] Error code:', error?.code);
    res.status(500).json({ 
      error: 'Failed to fetch clients',
      message: error?.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

// ✅ 3. 獲取特定學生詳情
router.get('/coaches/clients/:clientId', verifyJWT, async (req: any, res: any) => {
  try {
    const { clientId } = req.params;
    const coachId = req.user?.claims?.sub || req.user?.id;

    if (!coachId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // 驗證權限
    const relationshipResult = await db
      .select()
      .from(coachClientRelationships)
      .where(
        and(
          eq(coachClientRelationships.coachId, coachId),
          eq(coachClientRelationships.clientId, clientId)
        )
      )
      .limit(1);

    if (relationshipResult.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const clientResult = await db
      .select()
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1);

    const client = clientResult[0];

    res.json({
      ...relationshipResult[0],
      client,
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// ✅ 4. 移除學生（POST 方法）
router.post('/coaches/remove-client', verifyJWT, async (req: any, res: any) => {
  try {
    const { clientId } = req.body;
    const coachId = req.user?.claims?.sub || req.user?.id;

    console.log(`🟡 [API] POST /coaches/remove-client - coachId: ${coachId}, clientId: ${clientId}`);

    if (!coachId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const result = await db
      .delete(coachClientRelationships)
      .where(
        and(
          eq(coachClientRelationships.coachId, coachId),
          eq(coachClientRelationships.clientId, clientId)
        )
      )
      .returning();

    if (result.length === 0) {
      console.log(`❌ [API] Client relationship not found`);
      return res.status(404).json({ error: 'Client relationship not found' });
    }

    console.log(`✅ [API] Client relationship removed`);
    res.json({ success: true, message: 'Client removed' });
  } catch (error) {
    console.error('❌ [API] Error removing client:', error);
    res.status(500).json({ error: 'Failed to remove client' });
  }
});

// ✅ 4b. 移除學生（DELETE 方法，RESTful 風格）
router.delete('/coaches/clients/:clientId', verifyJWT, async (req: any, res: any) => {
  try {
    const { clientId } = req.params;
    const coachId = req.user?.claims?.sub || req.user?.id;

    console.log(`🟡 [API] DELETE /coaches/clients/${clientId} - coachId: ${coachId}`);

    if (!coachId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await db
      .delete(coachClientRelationships)
      .where(
        and(
          eq(coachClientRelationships.coachId, coachId),
          eq(coachClientRelationships.clientId, clientId)
        )
      )
      .returning();

    if (result.length === 0) {
      console.log(`❌ [API] Client relationship not found`);
      return res.status(404).json({ error: 'Client relationship not found' });
    }

    console.log(`✅ [API] Client relationship removed`);
    res.json({ success: true, message: 'Client removed successfully' });
  } catch (error) {
    console.error('❌ [API] Error removing client:', error);
    res.status(500).json({ error: 'Failed to remove client' });
  }
});

// ✅ 5. 更新學生狀態
router.put('/coaches/clients/:clientId', verifyJWT, async (req: any, res: any) => {
  try {
    const { clientId } = req.params;
    const { status, notes } = req.body;
    const coachId = req.user?.claims?.sub || req.user?.id;

    if (!coachId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // ✅ 驗證狀態值（數據庫枚舉：'ACTIVE', 'PAUSED', 'TERMINATED'）
    if (status && !['ACTIVE', 'PAUSED', 'TERMINATED'].includes(status.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid status. Must be ACTIVE, PAUSED, or TERMINATED' });
    }

    const updateData: any = {};
    if (status) updateData.status = status.toUpperCase(); // 轉換為大寫以匹配枚舉值
    if (notes !== undefined) updateData.notes = notes || null;

    const result = await db
      .update(coachClientRelationships)
      .set(updateData)
      .where(
        and(
          eq(coachClientRelationships.coachId, coachId),
          eq(coachClientRelationships.clientId, clientId)
        )
      )
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Relationship not found' });
    }

    res.json({ success: true, result: result[0] });
  } catch (error) {
    console.error('Error updating client status:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

export default router;

