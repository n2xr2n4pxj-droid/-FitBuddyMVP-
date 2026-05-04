/**
 * Invitations API Routes
 * 
 * 處理教練-客戶邀請相關的 API 端點
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, coachOnly } from '../middleware/auth';
import { 
  sendInvitation, 
  getInvitationStatus, 
  acceptInvitation,
  acceptInvitationById,
  getCoachInvitations,
  cancelInvitation,
  resendInvitation,
  getCoachTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createInvitationForExistingUser,
} from '../services/invitationService';
import { db } from '../db';
import { invitations } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { getUserById } from '../db/queries';
import { verifyJWT } from '../replitAuth';
import { config } from '../config/env';
import { sendError } from '../lib/response';
import { ErrorCodes } from '@shared/error-codes';

const router = Router();

/**
 * GET /share-token
 * 取得 coach 專屬分享 token（用於前端生成可追蹤邀請連結）
 */
router.get('/share-token', verifyJWT, async (req: any, res: any) => {
  try {
    const coachId = req.user?.id ?? req.user?.claims?.sub;
    if (!coachId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const currentUser = await getUserById(coachId);
    if (!currentUser) {
      return sendError(res, 401, ErrorCodes.AUTH_USER_NOT_FOUND, 'User not found');
    }

    const role = String(currentUser.role ?? '').toUpperCase();
    if (role !== 'COACH' && role !== 'ADMIN') {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, 'Only coach can generate share token');
    }

    const token = jwt.sign(
      {
        type: 'coach_ref',
        coachId,
      },
      config.jwt.secret,
      {
        expiresIn: '30d',
      }
    );

    return res.status(200).json({
      token,
      coachId,
      expiresIn: '30d',
    });
  } catch (error: any) {
    console.error('❌ [API] GET /invitations/share-token Error:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to generate share token');
  }
});

/**
 * GET /
 * 當前用戶相關邀請：發出的 + 收到的（需 JWT）
 */
router.get('/', verifyJWT, async (req: any, res: any) => {
  try {
    const currentId = req.user?.id ?? req.user?.claims?.sub;
    if (!currentId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }
    const currentUser = await getUserById(currentId);
    if (!currentUser) {
      return sendError(res, 401, ErrorCodes.AUTH_USER_NOT_FOUND, 'User not found');
    }

    const sent = await getCoachInvitations(currentId).catch(() => []);
    const receivedRows = await db
      .select()
      .from(invitations)
      .where(eq(invitations.receiverEmail, currentUser.email))
      .orderBy(desc(invitations.createdAt));

    const sentWithDir = Array.isArray(sent) ? sent.map((i: any) => ({ ...i, direction: 'sent' as const })) : [];
    const receivedWithDir = receivedRows.map((i) => ({ ...i, direction: 'received' as const }));

    const list = [...sentWithDir, ...receivedWithDir].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    return res.status(200).json(list);
  } catch (error: any) {
    console.error('❌ [API] GET /invitations Error:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get invitations');
  }
});

/**
 * POST /
 * 教練對已註冊用戶發送邀請（body: { email }）。若該 email 未註冊則回傳錯誤。
 */
router.post('/', verifyJWT, async (req: any, res: any) => {
  try {
    const coachId = req.user?.id ?? req.user?.claims?.sub;
    if (!coachId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }
    const currentUser = await getUserById(coachId);
    if (!currentUser) {
      return sendError(res, 401, ErrorCodes.AUTH_USER_NOT_FOUND, 'User not found');
    }
    const role = String(currentUser.role ?? '').toUpperCase();
    if (role !== 'COACH' && role !== 'ADMIN') {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, 'Only coach can send invitations');
    }

    const email = req.body?.email;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'email is required');
    }

    const result = await createInvitationForExistingUser(coachId, email.trim());
    if (!result.success) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, result.error ?? 'Invitation error');
    }
    return res.status(200).json(result.data);
  } catch (error: any) {
    console.error('❌ [API] POST /invitations Error:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to create invitation');
  }
});

/**
 * POST /send
 * 教練發送邀請
 */
router.post('/send', authMiddleware, coachOnly, async (req: any, res: any) => {
  try {
    const { client_email, client_name, notes } = req.body;
    const coachId = req.user?.id || req.user?.claims?.sub;

    console.log(`🟡 [API] POST /invitations/send - coachId: ${coachId}, email: ${client_email}`);

    if (!coachId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, '未認證');
    }

    // ✅ 驗證輸入
    if (!client_email) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'client_email 為必填項');
    }

    // ✅ 驗證郵箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(client_email)) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, '郵箱格式無效');
    }

    const result = await sendInvitation(coachId, client_email, client_name, notes);
    
    // 處理新的返回格式
    if (!result.success) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, result.error || '發送邀請失敗');
    }

    res.status(201).json({
      ...result.data,
      message: result.data?.message || '邀請已發送成功',
      logId: result.logId // 返回 Log ID
    });
  } catch (error: any) {
    console.error('❌ [API] Error sending invitation:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, '發送邀請失敗');
  }
});

/**
 * GET /status/:code
 * 檢查邀請狀態（公開，無需認證）
 */
router.get('/status/:code', async (req: any, res: any) => {
  try {
    const { code } = req.params;

    if (!code) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, '邀請碼為必填項');
    }

    const result = await getInvitationStatus(code);
    res.json(result);
  } catch (error: any) {
    console.error('❌ [API] Error getting invitation status:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, '獲取邀請狀態失敗');
  }
});

/**
 * POST /:id/accept
 * 已註冊學員依邀請 ID 接受邀請（需 JWT，且登入者須為被邀請人）
 */
router.post('/:id/accept', verifyJWT, async (req: any, res: any) => {
  try {
    const invitationId = req.params.id;
    const currentId = req.user?.id ?? req.user?.claims?.sub;
    if (!currentId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }
    const currentUser = await getUserById(currentId);
    if (!currentUser) {
      return sendError(res, 401, ErrorCodes.AUTH_USER_NOT_FOUND, 'User not found');
    }
    if (!invitationId) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, '邀請 ID 為必填項');
    }

    const result = await acceptInvitationById(
      invitationId,
      currentId,
      currentUser.email ?? ''
    );
    if (!result.success) {
      const status =
        result.error === '邀請不存在'
          ? 404
          : result.error === '僅被邀請人可接受此邀請'
            ? 403
            : 400;
      return sendError(res, status, ErrorCodes.FORBIDDEN, result.error ?? 'Invitation error');
    }
    return res.status(200).json(result.data);
  } catch (error: any) {
    console.error('❌ [API] POST /invitations/:id/accept Error:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, '接受邀請失敗');
  }
});

/**
 * POST /accept/:code
 * 接受邀請並創建賬戶（公開，無需認證）
 */
router.post('/accept/:code', async (req: any, res: any) => {
  try {
    const { code } = req.params;
    const { password, phone, agree_terms } = req.body;

    console.log(`🟡 [API] POST /invitations/accept/${code}`);

    if (!code) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, '邀請碼為必填項');
    }

    // ✅ 驗證必填項
    if (!password || agree_terms === undefined) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'password 和 agree_terms 為必填項');
    }

    // ✅ 驗證密碼強度
    if (password.length < 8) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, '密碼至少需要 8 個字符');
    }

    // ✅ 驗證 agree_terms 必須為 true
    if (agree_terms !== true) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, '必須同意服務條款');
    }

    const result = await acceptInvitation(code, { password, phone, agree_terms });
    res.json(result);
  } catch (error: any) {
    console.error('❌ [API] Error accepting invitation:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, '接受邀請失敗');
  }
});

/**
 * GET /coach/list
 * 教練查看自己發出的邀請
 */
router.get('/coach/list', authMiddleware, coachOnly, async (req: any, res: any) => {
  try {
    console.log('🟡 [API] GET /v1/invitations/coach/list - START');
    console.log('🟡 [API] Request user:', {
      hasUser: !!req.user,
      userId: req.user?.id,
      claimsSub: req.user?.claims?.sub,
      userRole: req.user?.role,
      userEmail: req.user?.email,
    });
    console.log('🟡 [API] Query params:', req.query);

    const coachId = req.user?.id || req.user?.claims?.sub;
    const { status } = req.query;

    console.log(`🟡 [API] coachId: ${coachId}, status filter: ${status}`);

    if (!coachId) {
      console.log('❌ [API] No coach ID found');
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, '未認證');
    }

    console.log('🟡 [API] Calling getCoachInvitations...');
    const result = await getCoachInvitations(coachId, status as string | undefined);
    console.log(`✅ [API] Found ${Array.isArray(result) ? result.length : 0} invitations`);
    console.log('✅ [API] Invitations data:', result);
    res.json(result);
  } catch (error: any) {
    console.error('❌ [API] Error getting coach invitations:', error);
    console.error('❌ [API] Error stack:', error?.stack);
    console.error('❌ [API] Error message:', error?.message);
    console.error('❌ [API] Error name:', error?.name);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, '獲取邀請列表失敗');
  }
});

/**
 * DELETE /:invitationId
 * 教練撤銷邀請
 */
router.delete('/:invitationId', authMiddleware, coachOnly, async (req: any, res: any) => {
  try {
    const coachId = req.user?.id || req.user?.claims?.sub;
    const { invitationId } = req.params;

    if (!coachId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, '未認證');
    }

    if (!invitationId) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, '邀請 ID 為必填項');
    }

    const result = await cancelInvitation(coachId, invitationId);
    res.json(result);
  } catch (error: any) {
    console.error('❌ [API] Error canceling invitation:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, '撤銷邀請失敗');
  }
});

/**
 * PATCH /resend/:invitationId
 * 教練重新發送邀請
 */
router.patch('/resend/:invitationId', authMiddleware, coachOnly, async (req: any, res: any) => {
  try {
    const coachId = req.user?.id || req.user?.claims?.sub;
    const { invitationId } = req.params;

    console.log(`🟡 [API] PATCH /invitations/resend/${invitationId} - coachId: ${coachId}`);

    if (!coachId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, '未認證');
    }

    if (!invitationId) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, '邀請 ID 為必填項');
    }

    const result = await resendInvitation(coachId, invitationId);
    
    if (!result.success) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, result.error || '重新發送邀請失敗');
    }

    res.json({
      ...result.data,
      message: result.data?.message || '邀請已重新發送成功',
      logId: result.logId
    });
  } catch (error: any) {
    console.error('❌ [API] Error resending invitation:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, '重新發送邀請失敗');
  }
});

/**
 * GET /templates
 * 獲取教練的所有模板
 */
router.get('/templates', authMiddleware, coachOnly, async (req: any, res: any) => {
  try {
    const coachId = req.user?.id || req.user?.claims?.sub;

    if (!coachId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, '未認證');
    }

    const templates = await getCoachTemplates(coachId);
    res.json(templates);
  } catch (error: any) {
    console.error('❌ [API] Error getting templates:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, '獲取模板失敗');
  }
});

/**
 * POST /templates
 * 創建新模板
 */
router.post('/templates', authMiddleware, coachOnly, async (req: any, res: any) => {
  try {
    const coachId = req.user?.id || req.user?.claims?.sub;
    const { name, message } = req.body;

    if (!coachId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, '未認證');
    }

    if (!name || !message) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, 'name 和 message 為必填項');
    }

    const template = await createTemplate(coachId, name, message);
    res.status(201).json(template);
  } catch (error: any) {
    console.error('❌ [API] Error creating template:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, '創建模板失敗');
  }
});

/**
 * PATCH /templates/:templateId
 * 更新模板
 */
router.patch('/templates/:templateId', authMiddleware, coachOnly, async (req: any, res: any) => {
  try {
    const coachId = req.user?.id || req.user?.claims?.sub;
    const { templateId } = req.params;
    const { name, message } = req.body;

    if (!coachId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, '未認證');
    }

    if (!templateId) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, '模板 ID 為必填項');
    }

    const updates: { name?: string; message?: string } = {};
    if (name !== undefined) updates.name = name;
    if (message !== undefined) updates.message = message;

    if (Object.keys(updates).length === 0) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, '至少需要提供一個更新字段');
    }

    const template = await updateTemplate(coachId, templateId, updates);
    res.json(template);
  } catch (error: any) {
    console.error('❌ [API] Error updating template:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, '更新模板失敗');
  }
});

/**
 * DELETE /templates/:templateId
 * 刪除模板
 */
router.delete('/templates/:templateId', authMiddleware, coachOnly, async (req: any, res: any) => {
  try {
    const coachId = req.user?.id || req.user?.claims?.sub;
    const { templateId } = req.params;

    if (!coachId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, '未認證');
    }

    if (!templateId) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, '模板 ID 為必填項');
    }

    const result = await deleteTemplate(coachId, templateId);
    res.json(result);
  } catch (error: any) {
    console.error('❌ [API] Error deleting template:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, '刪除模板失敗');
  }
});

export default router;
