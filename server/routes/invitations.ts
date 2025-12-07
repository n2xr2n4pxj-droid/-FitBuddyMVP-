import { Router } from 'express';
import { db } from '../db';
import { invitations, users, coachClientRelationships } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyJWT } from '../replitAuth';
import crypto from 'crypto';

const router = Router();

// 🔧 工具函數：生成邀請 token
const generateInvitationToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// ✅ 1. 發送邀請 (COACH 邀請 CLIENT)
router.post('/invitations/send', verifyJWT, async (req: any, res: any) => {
  try {
    const { clientEmail, message } = req.body;
    const coachId = req.user?.claims?.sub || req.user?.id;

    console.log(`🟡 [API] POST /invitations/send - coachId: ${coachId}, email: ${clientEmail}`);

    if (!coachId) {
      console.log('❌ [API] No coach ID found');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!clientEmail) {
      console.log('❌ [API] Client email required');
      return res.status(400).json({ error: 'Client email required' });
    }

    // 檢查自己不能邀請自己
    const coachResult = await db
      .select()
      .from(users)
      .where(eq(users.id, coachId))
      .limit(1);

    const coach = coachResult[0];

    if (!coach) {
      return res.status(401).json({ error: 'Coach not found' });
    }

    if (coach.email === clientEmail) {
      return res.status(400).json({ error: 'Cannot invite yourself' });
    }

    // 查詢接收方是否已註冊
    const clientResult = await db
      .select()
      .from(users)
      .where(eq(users.email, clientEmail))
      .limit(1);

    const client = clientResult[0] || null;

    // 檢查是否已經有 PENDING 的邀請
    const existingInvitation = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.senderId, coachId),
          eq(invitations.receiverEmail, clientEmail),
          eq(invitations.status, 'PENDING')
        )
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      console.log('⚠️ [API] Pending invitation already exists');
      return res.status(400).json({ error: 'Pending invitation already exists' });
    }

    // 如果已經是 ACTIVE 關係，不能再邀請
    if (client) {
      const existingRelationship = await db
        .select()
        .from(coachClientRelationships)
        .where(
          and(
            eq(coachClientRelationships.coachId, coachId),
            eq(coachClientRelationships.clientId, client.id),
            eq(coachClientRelationships.status, 'ACTIVE')
          )
        )
        .limit(1);

      if (existingRelationship.length > 0) {
        return res.status(400).json({ error: 'Already connected with this client' });
      }
    }

    // 生成 token 和過期時間
    const token = generateInvitationToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 天後過期

    // 創建邀請記錄
    const newInvitation = await db
      .insert(invitations)
      .values({
        senderId: coachId,
        receiverEmail: clientEmail,
        receiverId: client?.id || null,
        invitationType: 'COACH_TO_CLIENT',
        status: 'PENDING',
        message: message || null,
        token,
        expiresAt,
      })
      .returning();

    console.log(`✅ [API] Invitation sent to ${clientEmail}`);
    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      invitation: newInvitation[0],
    });
  } catch (error) {
    console.error('❌ [API] Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// ✅ 2. 接受邀請 (CLIENT 點擊郵件中的 accept 鏈接)
router.post('/invitations/accept/:token', verifyJWT, async (req: any, res: any) => {
  try {
    const { token } = req.params;
    const clientId = req.user?.claims?.sub || req.user?.id;

    console.log(`🟡 [API] POST /invitations/accept/${token} - clientId: ${clientId}`);

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    // 查詢邀請
    const invitationResult = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    const invitation = invitationResult[0];

    if (!invitation) {
      console.log('❌ [API] Invitation not found');
      return res.status(404).json({ error: 'Invalid invitation token' });
    }

    // 檢查過期
    if (new Date() > invitation.expiresAt) {
      console.log('❌ [API] Invitation expired');
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // 檢查狀態
    if (invitation.status !== 'PENDING') {
      console.log(`⚠️ [API] Invitation already ${invitation.status}`);
      return res.status(400).json({ error: `Invitation already ${invitation.status.toLowerCase()}` });
    }

    // 如果還沒有 receiverId，就使用當前用戶的 ID
    let finalClientId = invitation.receiverId || clientId;

    if (!finalClientId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // 檢查是否已經有 ACTIVE 關係
    const existingRelationship = await db
      .select()
      .from(coachClientRelationships)
      .where(
        and(
          eq(coachClientRelationships.coachId, invitation.senderId),
          eq(coachClientRelationships.clientId, finalClientId),
          eq(coachClientRelationships.status, 'ACTIVE')
        )
      )
      .limit(1);

    if (existingRelationship.length > 0) {
      // 更新邀請為 ACCEPTED，但不重複創建關係
      await db
        .update(invitations)
        .set({ status: 'ACCEPTED', respondedAt: new Date() })
        .where(eq(invitations.id, invitation.id));

      return res.status(400).json({ error: 'Relationship already exists' });
    }

    // 創建教練-客戶關係
    const newRelationship = await db
      .insert(coachClientRelationships)
      .values({
        coachId: invitation.senderId,
        clientId: finalClientId,
        status: 'ACTIVE',
      })
      .returning();

    // 更新邀請狀態
    const updatedInvitation = await db
      .update(invitations)
      .set({ status: 'ACCEPTED', respondedAt: new Date(), receiverId: finalClientId })
      .where(eq(invitations.id, invitation.id))
      .returning();

    console.log(`✅ [API] Invitation accepted, relationship created`);
    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      relationship: newRelationship[0],
      invitation: updatedInvitation[0],
    });
  } catch (error) {
    console.error('❌ [API] Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// ✅ 3. 拒絕邀請
router.post('/invitations/reject/:token', verifyJWT, async (req: any, res: any) => {
  try {
    const { token } = req.params;

    console.log(`🟡 [API] POST /invitations/reject/${token}`);

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    // 查詢邀請
    const invitationResult = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    const invitation = invitationResult[0];

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid invitation token' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ error: `Invitation already ${invitation.status.toLowerCase()}` });
    }

    // 更新邀請狀態
    const updatedInvitation = await db
      .update(invitations)
      .set({ status: 'REJECTED', respondedAt: new Date() })
      .where(eq(invitations.id, invitation.id))
      .returning();

    console.log(`✅ [API] Invitation rejected`);
    res.json({
      success: true,
      message: 'Invitation rejected',
      invitation: updatedInvitation[0],
    });
  } catch (error) {
    console.error('❌ [API] Error rejecting invitation:', error);
    res.status(500).json({ error: 'Failed to reject invitation' });
  }
});

// ✅ 4. 獲取待處理邀請（用戶視角）
router.get('/invitations/pending', verifyJWT, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // 找出所有待處理邀請（根據 email 或 receiverId）
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = userResult[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 查詢待處理邀請
    const pendingInvitations = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.status, 'PENDING'),
          eq(invitations.receiverEmail, user.email)
        )
      );

    console.log(`✅ [API] Found ${pendingInvitations.length} pending invitations for ${user.email}`);
    res.json(pendingInvitations);
  } catch (error) {
    console.error('❌ [API] Error fetching pending invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

export default router;

