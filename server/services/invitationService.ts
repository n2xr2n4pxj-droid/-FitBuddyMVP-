/**
 * Invitation Service - 邀請業務邏輯層
 * 
 * 處理教練-客戶邀請的業務邏輯，包括：
 * - 發送邀請
 * - 驗證邀請碼
 * - 接受邀請並創建賬戶
 * - 查詢邀請列表
 * - 撤銷邀請
 */

import { db, pool } from '../db';
import { invitations, users, coachClients, invitationTemplates } from '../db/schema';
import emailService from './emailService';
import { eq, and, or, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { hashPassword } from '../replitAuth';
import { config } from '../config/env';
import { getUserByEmail } from '../db/queries';

const INVITATION_CODE_LENGTH = 32;
const INVITATION_EXPIRY_DAYS = 30;

/**
 * 生成唯一的邀請 token
 */
function generateInvitationToken(): string {
  return crypto.randomBytes(INVITATION_CODE_LENGTH / 2).toString('hex');
}

/**
 * 僅對「已註冊用戶」建立邀請記錄（教練邀請已註冊用戶）
 * 若該 email 未註冊則回傳錯誤，請對方先註冊。
 */
export async function createInvitationForExistingUser(
  coachId: string,
  email: string
): Promise<{ success: true; data: any } | { success: false; error: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await getUserByEmail(normalizedEmail);
  if (!existingUser) {
    return { success: false, error: 'user not found, please ask them to register first' };
  }

  const invitationToken = generateInvitationToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

  const [newInvitation] = await db
    .insert(invitations)
    .values({
      senderId: coachId,             // UUID / varchar
      receiverEmail: normalizedEmail,
      receiverId: existingUser.id,   // 綁定到已存在用戶
      invitationType: 'COACH_TO_CLIENT',
      status: 'PENDING',
      token: invitationToken,
      expiresAt,
      message: null,
    })
    .returning();

  return { success: true, data: newInvitation };
}

/**
 * 教練發送邀請給客戶（改進版）
 * 返回結構化響應，包含 logId 用於錯誤追蹤
 */
export async function sendInvitation(
  coachId: string,
  clientEmail: string,
  clientName?: string,
  notes?: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  errorCode?: string;
  logId?: string;
}> {
  try {
    const [sender] = await db
      .select({ 
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        // 注意：users 表中沒有 phone 列，已從查詢中移除
      })
      .from(users)
      .where(eq(users.id, coachId))
      .limit(1);

    if (!sender) {
      return {
        success: false,
        error: '教練信息不存在',
        errorCode: 'COACH_NOT_FOUND'
      };
    }

    // 檢查角色（role 可能是 'coach' 或 'COACH'）
    const role = sender.role?.toUpperCase();
    if (!role || (role !== 'COACH' && role !== 'ADMIN')) {
      return {
        success: false,
        error: '只有教練可以發送邀請',
        errorCode: 'UNAUTHORIZED'
      };
    }

    // ✅ 檢查用戶是否已存在
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, clientEmail))
      .limit(1);

    if (existingUser.length > 0) {
      return {
        success: false,
        error: '此郵箱已經註冊過了',
        errorCode: 'USER_ALREADY_EXISTS'
      };
    }

    // ✅ 檢查是否已有待處理的邀請
    const existingInvite = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.senderId, coachId),
          eq(invitations.receiverEmail, clientEmail),
          eq(invitations.status, 'PENDING')
        )
      )
      .limit(1);

    if (existingInvite.length > 0) {
      return {
        success: false,
        error: '已經向此郵箱發送過邀請，請等待對方接受',
        errorCode: 'DUPLICATE_INVITATION'
      };
    }

    // ✅ 生成邀請 token 和過期時間
    const invitationToken = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    // ✅ 在數據庫中創建邀請記錄
    // coachId 用於查詢（integer）
    const [newInvitation] = await db
      .insert(invitations)
      .values({
        senderId: coachId,
        receiverEmail: clientEmail,
        invitationType: 'COACH_TO_CLIENT',
        status: 'PENDING',
        token: invitationToken,
        expiresAt,
        message: notes || null,
        // 注意：invitations 表不包含 phone 字段，只包含上述字段
      })
      .returning();

    // ✅ 獲取教練信息
    const coachName = `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.email;

    // ✅ 發送邀請郵件（使用新的 emailService）
    const invitationLink = `${config.app.appUrl || config.app.clientUrl || 'http://localhost:5173'}/auth/accept-invitation/${invitationToken}`;
    
    const emailResult = await emailService.sendEmail({
      to: clientEmail,
      subject: `${coachName} 邀請你加入 FitBuddy 🏋️`,
      html: generateInvitationEmailHTML(
        sender,
        invitationLink,
        notes,
        expiresAt,
        clientName
      ),
      type: 'invitation',
    });

    // 如果郵件發送失敗，返回詳細錯誤信息
    if (!emailResult.success) {
      return {
        success: false,
        error: emailResult.error || '郵件發送失敗',
        errorCode: emailResult.errorCode || 'EMAIL_SEND_FAILED',
        logId: emailResult.logId // 傳遞 Log ID 用於追蹤
      };
    }

    return {
      success: true,
      data: {
        id: newInvitation.id,
        invitation_code: newInvitation.token,
        expires_at: newInvitation.expiresAt,
        created_at: newInvitation.createdAt,
        message: '邀請已發送成功'
      },
      logId: emailResult.logId // 返回 Log ID 用於追蹤
    };
  } catch (error: any) {
    console.error('❌ 發送邀請時出錯:', error);
    return {
      success: false,
      error: error.message || '發送邀請失敗',
      errorCode: 'INTERNAL_ERROR'
    };
  }
}

/**
 * 生成邀請郵件 HTML 模板
 */
function generateInvitationEmailHTML(
  coach: { firstName?: string | null; lastName?: string | null; email: string },
  invitationLink: string,
  message: string | undefined,
  expiresAt: Date,
  clientName?: string
): string {
  const coachName = `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || coach.email;
  const supportEmail = config.email.supportEmail || config.email.replyTo || 'support@fitbuddy.hk';
  
  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FitBuddy 邀請</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #333; 
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background-color: #ffffff;
    }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      color: white; 
      padding: 30px 20px; 
      text-align: center; 
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content { 
      padding: 30px; 
    }
    .button { 
      display: inline-block; 
      background: #667eea; 
      color: white; 
      padding: 14px 32px; 
      border-radius: 6px; 
      text-decoration: none; 
      margin: 20px 0; 
      font-weight: 600;
      transition: background 0.2s;
    }
    .button:hover {
      background: #5568d3;
    }
    .footer { 
      background: #f0f0f0; 
      padding: 20px; 
      font-size: 12px; 
      text-align: center; 
      color: #666; 
    }
    .coach-info { 
      background: #f9fafb; 
      padding: 20px; 
      border-radius: 6px; 
      margin: 20px 0; 
      border-left: 4px solid #667eea; 
    }
    .message-box {
      background: #e8f5e9;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #28a745;
      margin: 20px 0;
    }
    .link-box {
      background: #e9ecef;
      padding: 10px;
      border-radius: 4px;
      word-break: break-all;
      font-family: monospace;
      font-size: 12px;
      margin: 10px 0;
    }
    .expiry-notice {
      color: #999;
      font-size: 12px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 FitBuddy 邀請</h1>
    </div>
    
    <div class="content">
      <p>你好${clientName ? `，${clientName}` : ''}！</p>
      
      <p><strong>${coachName}</strong> 邀請你在 FitBuddy 上成為他的客戶。</p>
      
      <div class="coach-info">
        <p style="margin-top: 0;"><strong>教練資料：</strong></p>
        <p>姓名：${coachName}</p>
        <p>郵箱：${coach.email}</p>
      </div>

      ${message ? `
        <div class="message-box">
          <p style="margin-top: 0;"><strong>教練的信息：</strong></p>
          <p>${message}</p>
        </div>
      ` : ''}

      <p>點擊下方按鈕接受邀請，開始你的健身旅程：</p>
      
      <div style="text-align: center;">
        <a href="${invitationLink}" class="button">接受邀請</a>
      </div>

      <p style="color: #666; font-size: 14px;">
        或複製以下鏈接到瀏覽器：
      </p>
      <div class="link-box">
        ${invitationLink}
      </div>

      <p class="expiry-notice">
        ⏰ 此邀請將在 ${expiresAt.toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' })} 過期
      </p>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} FitBuddy. All rights reserved.</p>
      <p>如有任何問題，請聯繫我們：<a href="mailto:${supportEmail}" style="color: #667eea;">${supportEmail}</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 獲取邀請狀態（用於驗證邀請碼）
 */
export async function getInvitationStatus(invitationCode: string) {
  try {
    const [invitation] = await db
      .select({
        id: invitations.id,
        status: invitations.status,
        receiverEmail: invitations.receiverEmail,
        senderId: invitations.senderId,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .where(eq(invitations.token, invitationCode))
      .limit(1);

    if (!invitation) {
      throw new Error('邀請碼無效');
    }

    // ✅ 檢查是否過期
    if (new Date(invitation.expiresAt) < new Date()) {
      // 更新狀態為過期
      await db
        .update(invitations)
        .set({ status: 'EXPIRED' })
        .where(eq(invitations.id, invitation.id));
      
      throw new Error('邀請已過期，請重新申請');
    }

    // ✅ 檢查邀請狀態
    if (invitation.status !== 'PENDING') {
      const statusMap: Record<string, string> = {
        'ACCEPTED': '已接受',
        'REJECTED': '已拒絕',
        'EXPIRED': '已過期'
      };
      throw new Error(`邀請已${statusMap[invitation.status] || invitation.status}`);
    }

    // 獲取客戶名稱（如果有的話）
    const [receiverUser] = await db
      .select({ 
        firstName: users.firstName,
        lastName: users.lastName 
      })
      .from(users)
      .where(eq(users.email, invitation.receiverEmail))
      .limit(1);

    const clientName = receiverUser 
      ? `${receiverUser.firstName || ''} ${receiverUser.lastName || ''}`.trim() || invitation.receiverEmail
      : invitation.receiverEmail;

    return {
      id: invitation.id,
      status: invitation.status,
      client_email: invitation.receiverEmail,
      client_name: clientName,
      coach_id: invitation.senderId
    };
  } catch (error) {
    console.error('❌ 獲取邀請狀態時出錯:', error);
    throw error;
  }
}

/**
 * 接受邀請並創建新用戶賬戶
 */
export async function acceptInvitation(
  invitationCode: string,
  userData: {
    password: string;
    phone?: string;
    agree_terms: boolean;
  }
) {
  try {
    console.log('🟡 [acceptInvitation] START - code:', invitationCode.substring(0, 8) + '...');

    // ✅ 參數驗證
    if (!invitationCode || typeof invitationCode !== 'string') {
      throw new Error('邀請碼無效');
    }

    if (!userData.password || userData.password.length < 8) {
      throw new Error('密碼至少需要 8 個字符');
    }

    if (!userData.agree_terms) {
      throw new Error('必須同意服務條款');
    }

    // ✅ 獲取邀請信息
    const [invitation] = await db
      .select({
        id: invitations.id,
        receiverEmail: invitations.receiverEmail,
        senderId: invitations.senderId,
        expiresAt: invitations.expiresAt,
        status: invitations.status,
        message: invitations.message,
      })
      .from(invitations)
      .where(eq(invitations.token, invitationCode))
      .limit(1);

    if (!invitation) {
      throw new Error('邀請碼無效');
    }

    console.log('🟡 [acceptInvitation] Invitation found:', {
      id: invitation.id,
      email: invitation.receiverEmail,
      status: invitation.status,
    });

    // ✅ 檢查是否過期
    if (new Date(invitation.expiresAt) < new Date()) {
      throw new Error('邀請已過期');
    }

    // ✅ 檢查是否已被處理
    if (invitation.status !== 'PENDING') {
      throw new Error('邀請已被處理');
    }

    // ✅ 檢查用戶是否已存在
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, invitation.receiverEmail))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error('此郵箱已經註冊過了');
    }

    // ✅ 加密密碼（使用項目現有的密碼哈希方法）
    const hashedPassword = hashPassword(userData.password);

    // ✅ 創建新用戶（客戶身份）
    // 注意：數據庫中 role 默認值是 'client'（小寫），不是 'USER'
    // 邀請註冊時自動驗證郵箱（emailVerified = true, emailVerificationToken = null）
    const { pool } = await import('../db');
    const userResult = await pool.query(
      `INSERT INTO users (
        email, 
        password_hash, 
        role, 
        email_verified, 
        email_verification_token,
        first_name,
        last_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, role, first_name, last_name`,
      [
        invitation.receiverEmail.toLowerCase().trim(), // email (必需)
        hashedPassword, // password_hash (必需)
        'client', // role (必需，使用小寫 'client' 而不是 'USER')
        true, // email_verified (必需，邀請註冊時自動驗證)
        null, // email_verification_token (可選，清除驗證 token)
        null, // first_name (可選)
        null, // last_name (可選)
      ]
    );
    
    if (!userResult.rows || userResult.rows.length === 0) {
      throw new Error('創建用戶失敗');
    }

    const newUser = userResult.rows[0];
    console.log('🟡 [acceptInvitation] User created:', {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    // coach-client 關聯統一在後續的 coachClients insert 步驟完成，此處不再寫入廢棄表
    console.log('🟡 [acceptInvitation] Coach-client relationship will be created via coachClients');

    // ✅ 更新邀請狀態為已接受
    await db
      .update(invitations)
      .set({ 
        status: 'ACCEPTED',
        respondedAt: new Date(),
        receiverId: newUser.id,
      })
      .where(eq(invitations.id, invitation.id));

    console.log('🟡 [acceptInvitation] Invitation status updated to ACCEPTED');

    return {
      user_id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      message: '賬戶創建成功！'
    };
  } catch (error) {
    console.error('❌ [acceptInvitation] 接受邀請時出錯:', error);
    throw error;
  }
}

/**
 * 已註冊學員依邀請 ID 接受邀請（UUID 架構）
 * 驗證邀請存在、未過期、狀態為 PENDING，且當前用戶為被邀請人，然後更新邀請為 ACCEPTED 並在 coach_clients 建立關聯。
 */
export async function acceptInvitationById(
  invitationId: string,
  clientId: string,
  clientEmail: string
): Promise<{ success: true; data: any } | { success: false; error: string }> {
  const id = String(invitationId).trim();
  const normalizedEmail = String(clientEmail).trim().toLowerCase();

  const [invitation] = await db
    .select({
      id: invitations.id,
      senderId: invitations.senderId,
      receiverEmail: invitations.receiverEmail,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(eq(invitations.id, id))
    .limit(1);

  if (!invitation) {
    return { success: false, error: '邀請不存在' };
  }

  if (invitation.status !== 'PENDING') {
    return { success: false, error: '邀請已處理過' };
  }

  const expiresAt = new Date(invitation.expiresAt);
  if (expiresAt < new Date()) {
    await db
      .update(invitations)
      .set({ status: 'EXPIRED' })
      .where(eq(invitations.id, id));
    return { success: false, error: '邀請已過期' };
  }

  if (invitation.receiverEmail.toLowerCase() !== normalizedEmail) {
    return { success: false, error: '僅被邀請人可接受此邀請' };
  }

  const coachId = invitation.senderId;

  const [existing] = await db
    .select({ id: coachClients.id })
    .from(coachClients)
    .where(
      and(
        eq(coachClients.coachId, coachId),
        eq(coachClients.clientId, clientId)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(invitations)
      .set({
        status: 'ACCEPTED',
        respondedAt: new Date(),
        receiverId: clientId,
      })
      .where(eq(invitations.id, id));
    return {
      success: true,
      data: { message: '已建立教練-學員關聯', alreadyLinked: true },
    };
  }

  await db
    .update(invitations)
    .set({
      status: 'ACCEPTED',
      respondedAt: new Date(),
      receiverId: clientId,
    })
    .where(eq(invitations.id, id));

  const [inserted] = await db
    .insert(coachClients)
    .values({
      coachId,
      clientId,
      status: 'active',
    })
    .returning({ id: coachClients.id, coachId: coachClients.coachId, clientId: coachClients.clientId });

  return {
    success: true,
    data: {
      invitationId: id,
      relationship: inserted,
      message: '邀請已接受，教練-學員關聯已建立',
    },
  };
}

/**
 * 教練查看自己發出的所有邀請
 */
export async function getCoachInvitations(coachId: string, status?: string) {
  try {
    console.log('🟡 [getCoachInvitations] START - coachId:', coachId, 'status:', status);
    
    const conditions = [eq(invitations.senderId, coachId)];
    
    if (status) {
      console.log('🟡 [getCoachInvitations] Adding status filter:', status);
      conditions.push(eq(invitations.status, status as any));
    }

    console.log('🟡 [getCoachInvitations] Querying database...');
    const result = await db
      .select({
        id: invitations.id,
        receiverEmail: invitations.receiverEmail,
        status: invitations.status,
        createdAt: invitations.createdAt,
        expiresAt: invitations.expiresAt,
        respondedAt: invitations.respondedAt,
        message: invitations.message,
      })
      .from(invitations)
      .where(and(...conditions))
      .orderBy(desc(invitations.createdAt));

    console.log(`🟡 [getCoachInvitations] Found ${result.length} invitations`);

    // 獲取客戶名稱（如果已註冊）
    console.log('🟡 [getCoachInvitations] Enriching with client names...');
    const invitationsWithNames = await Promise.all(
      result.map(async (inv) => {
        const [user] = await db
          .select({ 
            firstName: users.firstName,
            lastName: users.lastName 
          })
          .from(users)
          .where(eq(users.email, inv.receiverEmail))
          .limit(1);

        const clientName = user
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || inv.receiverEmail
          : inv.receiverEmail;

        return {
          ...inv,
          client_email: inv.receiverEmail,
          client_name: clientName,
        };
      })
    );

    console.log('✅ [getCoachInvitations] Returning', invitationsWithNames.length, 'invitations');
    return invitationsWithNames;
  } catch (error: any) {
    console.error('❌ [getCoachInvitations] Error:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
    });
    throw error;
  }
}

/**
 * 教練撤銷邀請
 */
export async function cancelInvitation(coachId: string, invitationId: string) {
  try {
    const [updated] = await db
      .update(invitations)
      .set({ status: 'REJECTED' })
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.senderId, coachId),
          eq(invitations.status, 'PENDING')
        )
      )
      .returning({
        id: invitations.id,
        receiverEmail: invitations.receiverEmail,
      });

    if (!updated) {
      throw new Error('無法撤銷此邀請');
    }

    return { 
      id: updated.id,
      message: `已撤銷向 ${updated.receiverEmail} 的邀請`
    };
  } catch (error) {
    console.error('❌ 撤銷邀請時出錯:', error);
    throw error;
  }
}

/**
 * 教練重新發送邀請
 * 只有 EXPIRED 或 REJECTED 狀態的邀請可以重新發送
 */
export async function resendInvitation(
  coachId: string,
  invitationId: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  errorCode?: string;
  logId?: string;
}> {
  try {
    console.log(`🟡 [resendInvitation] START - coachId: ${coachId}, invitationId: ${invitationId}`);

    // ✅ 查詢邀請記錄
    const [invitation] = await db
      .select({
        id: invitations.id,
        senderId: invitations.senderId,
        receiverEmail: invitations.receiverEmail,
        status: invitations.status,
        message: invitations.message,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1);

    if (!invitation) {
      return {
        success: false,
        error: '邀請不存在',
        errorCode: 'INVITATION_NOT_FOUND'
      };
    }

    if (invitation.senderId !== coachId) {
      return {
        success: false,
        error: '無權限重新發送此邀請',
        errorCode: 'UNAUTHORIZED'
      };
    }

    // ✅ 驗證邀請狀態必須是 EXPIRED 或 REJECTED
    if (invitation.status !== 'EXPIRED' && invitation.status !== 'REJECTED') {
      return {
        success: false,
        error: '只有已過期或已拒絕的邀請可以重新發送',
        errorCode: 'INVALID_STATUS'
      };
    }

    // ✅ 獲取教練信息
    const [sender] = await db
      .select({ 
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        // 注意：users 表中沒有 phone 列，已從查詢中移除
      })
      .from(users)
      .where(eq(users.id, coachId))
      .limit(1);

    if (!sender) {
      return {
        success: false,
        error: '教練信息不存在',
        errorCode: 'COACH_NOT_FOUND'
      };
    }

    // ✅ 生成新的邀請 token
    const newInvitationToken = generateInvitationToken();
    
    // ✅ 更新過期時間為 30 天後
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    // ✅ 重置邀請狀態為 PENDING
    const [updated] = await db
      .update(invitations)
      .set({
        status: 'PENDING',
        token: newInvitationToken,
        expiresAt: newExpiresAt,
        respondedAt: null, // 清除之前的回應時間
      })
      .where(eq(invitations.id, invitationId))
      .returning({
        id: invitations.id,
        receiverEmail: invitations.receiverEmail,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
      });

    if (!updated) {
      return {
        success: false,
        error: '更新邀請失敗',
        errorCode: 'UPDATE_FAILED'
      };
    }

    // ✅ 獲取客戶名稱（如果已註冊）
    const [receiverUser] = await db
      .select({ 
        firstName: users.firstName,
        lastName: users.lastName 
      })
      .from(users)
      .where(eq(users.email, invitation.receiverEmail))
      .limit(1);

    const clientName = receiverUser
      ? `${receiverUser.firstName || ''} ${receiverUser.lastName || ''}`.trim() || invitation.receiverEmail
      : undefined;

    // ✅ 重新發送邀請郵件
    const coachName = `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.email;
    const invitationLink = `${process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173'}/auth/accept-invitation/${newInvitationToken}`;
    
    const emailResult = await emailService.sendEmail({
      to: invitation.receiverEmail,
      subject: `${coachName} 重新邀請你加入 FitBuddy 🏋️`,
      html: generateInvitationEmailHTML(
        sender,
        invitationLink,
        invitation.message || undefined,
        newExpiresAt,
        clientName
      ),
      type: 'invitation',
    });

    // 如果郵件發送失敗，返回詳細錯誤信息
    if (!emailResult.success) {
      return {
        success: false,
        error: emailResult.error || '郵件發送失敗',
        errorCode: emailResult.errorCode || 'EMAIL_SEND_FAILED',
        logId: emailResult.logId
      };
    }

    console.log(`✅ [resendInvitation] Success - invitationId: ${invitationId}`);

    return {
      success: true,
      data: {
        id: updated.id,
        invitation_code: newInvitationToken,
        expires_at: updated.expiresAt,
        status: updated.status,
        message: '邀請已重新發送成功'
      },
      logId: emailResult.logId
    };
  } catch (error: any) {
    console.error('❌ 重新發送邀請時出錯:', error);
    return {
      success: false,
      error: error.message || '重新發送邀請失敗',
      errorCode: 'INTERNAL_ERROR'
    };
  }
}

/**
 * 獲取教練的所有邀請模板
 */
export async function getCoachTemplates(coachId: string) {
  try {
    const templates = await db
      .select()
      .from(invitationTemplates)
      .where(eq(invitationTemplates.coachId, coachId))
      .orderBy(desc(invitationTemplates.createdAt));

    return templates;
  } catch (error) {
    console.error('❌ 獲取模板時出錯:', error);
    throw error;
  }
}

/**
 * 創建新模板
 */
export async function createTemplate(
  coachId: string,
  name: string,
  message: string
) {
  try {
    // 驗證名稱長度
    if (name.length > 50) {
      throw new Error('模板名稱不能超過 50 個字符');
    }

    // 驗證內容長度
    if (message.length > 500) {
      throw new Error('模板內容不能超過 500 個字符');
    }

    // 檢查是否已存在同名模板
    const existing = await db
      .select()
      .from(invitationTemplates)
      .where(
        and(
          eq(invitationTemplates.coachId, coachId),
          eq(invitationTemplates.name, name)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error('已存在同名模板');
    }

    const [newTemplate] = await db
      .insert(invitationTemplates)
      .values({
        coachId,
        name: name.trim(),
        message: message.trim(),
        isDefault: false,
      })
      .returning();

    return newTemplate;
  } catch (error) {
    console.error('❌ 創建模板時出錯:', error);
    throw error;
  }
}

/**
 * 更新模板
 */
export async function updateTemplate(
  coachId: string,
  templateId: string,
  updates: { name?: string; message?: string }
) {
  try {
    // 驗證模板屬於當前教練
    const [template] = await db
      .select()
      .from(invitationTemplates)
      .where(
        and(
          eq(invitationTemplates.id, templateId),
          eq(invitationTemplates.coachId, coachId)
        )
      )
      .limit(1);

    if (!template) {
      throw new Error('模板不存在或無權限');
    }

    // 驗證更新數據
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updates.name !== undefined) {
      if (updates.name.length > 50) {
        throw new Error('模板名稱不能超過 50 個字符');
      }
      // 如果更新名稱，檢查是否與其他模板重名
      if (updates.name.trim() !== template.name) {
        const existing = await db
          .select()
          .from(invitationTemplates)
          .where(
            and(
              eq(invitationTemplates.coachId, coachId),
              eq(invitationTemplates.name, updates.name.trim())
            )
          )
          .limit(1);

        if (existing.length > 0) {
          throw new Error('已存在同名模板');
        }
      }
      updateData.name = updates.name.trim();
    }

    if (updates.message !== undefined) {
      if (updates.message.length > 500) {
        throw new Error('模板內容不能超過 500 個字符');
      }
      updateData.message = updates.message.trim();
    }

    const [updated] = await db
      .update(invitationTemplates)
      .set(updateData)
      .where(eq(invitationTemplates.id, templateId))
      .returning();

    return updated;
  } catch (error) {
    console.error('❌ 更新模板時出錯:', error);
    throw error;
  }
}

/**
 * 刪除模板
 */
export async function deleteTemplate(coachId: string, templateId: string) {
  try {
    // 驗證模板屬於當前教練
    const [template] = await db
      .select()
      .from(invitationTemplates)
      .where(
        and(
          eq(invitationTemplates.id, templateId),
          eq(invitationTemplates.coachId, coachId)
        )
      )
      .limit(1);

    if (!template) {
      throw new Error('模板不存在或無權限');
    }

    await db
      .delete(invitationTemplates)
      .where(eq(invitationTemplates.id, templateId));

    return { success: true, message: '模板已刪除' };
  } catch (error) {
    console.error('❌ 刪除模板時出錯:', error);
    throw error;
  }
}

