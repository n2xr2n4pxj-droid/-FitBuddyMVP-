/**
 * Email Service - SendGrid 郵件服務（改進版）
 * 
 * 使用 SendGrid 發送郵件，包括邀請郵件等功能
 * 支持郵件日誌記錄和錯誤追蹤
 */

import sgMail from '@sendgrid/mail';
import { db } from '../db';
import { emailLogs } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { log } from '../vite';
import crypto from 'crypto';
import { config } from '../config/env';

// 初始化 SendGrid（從環境變量管理系統讀取）
if (config.email.sendgridApiKey) {
  sgMail.setApiKey(config.email.sendgridApiKey);
} else {
  log('⚠️  [Email Service] SENDGRID_API_KEY 未設置，郵件功能將無法使用', 'email');
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  replyTo?: string;
  type?: string; // 'invitation', 'password_reset', 'verification', etc.
}

interface EmailLog {
  id: string;
  type: string;
  to: string;
  subject: string;
  success: boolean;
  error?: string | null;
  errorCode?: string | null;
  errorDetails?: string | null; // JSON 字符串，包含完整的 SendGrid 錯誤
  sendGridResponse?: string | null; // SendGrid 返回的原始響應
  messageId?: string | null; // SendGrid 的 message ID
  timestamp: Date;
}

export const emailService = {
  /**
   * 初始化郵件服務
   */
  async initialize() {
    if (config.email.sendgridApiKey) {
      sgMail.setApiKey(config.email.sendgridApiKey);
      log('✅ [Email Service] SendGrid 已初始化', 'email');
    } else {
      log('⚠️  [Email Service] SENDGRID_API_KEY 未設置，郵件功能將無法使用', 'email');
    }
  },

  /**
   * 發送郵件
   */
  async sendEmail(options: SendEmailOptions): Promise<{
    success: boolean;
    logId: string;
    error?: string;
    errorCode?: string;
  }> {
    const logId = crypto.randomUUID(); // 生成唯一 Log ID

    try {
      // 驗證 SendGrid 配置
      if (!config.email.sendgridApiKey) {
        throw new Error('SendGrid API key not configured');
      }

      const fromEmail = config.email.sendgridFromEmail;
      const replyTo = options.replyTo || config.email.sendgridReplyTo || config.email.sendgridSupportEmail || fromEmail;
      const emailType = options.type || 'general';

      const msg: any = {
        to: options.to,
        from: fromEmail,
        replyTo: replyTo,
        subject: options.subject
      };

      // 使用模板或 HTML 內容
      if (options.templateId) {
        msg.templateId = options.templateId;
        msg.dynamicTemplateData = options.templateData || {};
      } else {
        msg.html = options.html;
        if (options.text) {
          msg.text = options.text;
        }
      }

      // 發送郵件
      let response;
      try {
        response = await sgMail.send(msg);
        
        // 獲取 SendGrid 的 message ID
        const messageId = (response[0] as any)?.headers?.['x-message-id'] || 
                         (response as any)?.headers?.['x-message-id'] ||
                         undefined;

        // 記錄成功（包含 message_id）
        await this.logEmail({
          id: logId,
          type: emailType,
          to: options.to,
          subject: options.subject,
          success: true,
          messageId: messageId || null,
          timestamp: new Date()
        });

        log(`✅ [Email Service] 郵件已發送 | LogID: ${logId} | MessageID: ${messageId || 'N/A'}`, 'email');

        return {
          success: true,
          logId
        };
      } catch (sgError: any) {
        // SendGrid 特定錯誤處理
        const errorCode = sgError.code || sgError.status || 'UNKNOWN';
        const errorMessage = sgError.message || 'Unknown SendGrid error';
        
        // 詳細的錯誤信息（用於日誌）
        const errorDetails = {
          code: errorCode,
          message: errorMessage,
          response: sgError.response?.body || sgError.response,
          timestamp: new Date().toISOString()
        };

        const userFriendlyError = this.getUserFriendlyError(errorCode, errorMessage);

        // 記錄失敗
        await this.logEmail({
          id: logId,
          type: emailType,
          to: options.to,
          subject: options.subject,
          success: false,
          error: userFriendlyError,
          errorCode: errorCode.toString(),
          errorDetails: JSON.stringify(errorDetails),
          sendGridResponse: JSON.stringify(sgError.response?.body || {}),
          timestamp: new Date()
        });

        log(`❌ [Email Service] 郵件發送失敗 | LogID: ${logId} | 錯誤: ${userFriendlyError}`, 'email');

        return {
          success: false,
          logId,
          error: userFriendlyError,
          errorCode: errorCode.toString()
        };
      }
    } catch (error: any) {
      // 通用錯誤處理
      const errorMessage = error.message || 'Unknown error';
      const emailType = options.type || 'general';

      await this.logEmail({
        id: logId,
        type: emailType,
        to: options.to,
        subject: options.subject,
        success: false,
        error: errorMessage,
        errorCode: 'INTERNAL_ERROR',
        errorDetails: JSON.stringify({
          message: errorMessage,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }),
        timestamp: new Date()
      });

      log(`❌ [Email Service] 郵件發送失敗（內部錯誤）| LogID: ${logId} | 錯誤: ${errorMessage}`, 'email');

      return {
        success: false,
        logId,
        error: errorMessage,
        errorCode: 'INTERNAL_ERROR'
      };
    }
  },

  /**
   * 用戶友好的錯誤信息映射
   */
  getUserFriendlyError(
    errorCode: string | number,
    originalMessage: string
  ): string {
    const errorMap: Record<string, string> = {
      '400': '郵箱地址無效。請檢查郵箱格式。',
      '401': '郵件服務認證失敗。請聯繫管理員。',
      '403': '沒有發送郵件的權限。請聯繫管理員。',
      '429': '請求過於頻繁。請稍後再試。',
      '500': '郵件服務暫時不可用。請稍後再試。',
      '503': '郵件服務維護中。請稍後再試。',
      'ECONNREFUSED': '無法連接到郵件服務。請檢查網絡連接。',
      'ENOTFOUND': '郵件服務無法訪問。請檢查網絡設置。',
      'ETIMEDOUT': '郵件服務連接超時。請稍後再試。',
      'UNKNOWN': '郵件發送失敗。請稍後再試。'
    };

    return (
      errorMap[errorCode.toString()] ||
      errorMap[originalMessage] ||
      `郵件發送失敗：${originalMessage}`
    );
  },

  /**
   * 記錄郵件到數據庫
   * 字段映射：
   * - to → recipient_email
   * - success → status (sent/failed)
   * - timestamp → sent_at
   * - error → error_message
   */
  async logEmail(logData: EmailLog): Promise<void> {
    try {
      // 將字段映射到實際數據庫表結構
      await db.insert(emailLogs).values({
        id: logData.id,
        type: logData.type || 'general',
        recipient_email: logData.to, // ✅ 映射：to → recipient_email
        subject: logData.subject,
        message_id: logData.messageId || null, // ✅ SendGrid 的 message ID
        status: logData.success ? 'sent' : 'failed', // ✅ 映射：success → status
        error_message: logData.error || null, // ✅ 映射：error → error_message
        sent_at: logData.timestamp, // ✅ 映射：timestamp → sent_at
        // created_at 會自動使用默認值 NOW()
        // 注意：以下字段在數據庫中不存在，已移除
        // errorCode: logData.errorCode || null,
        // errorDetails: logData.errorDetails || null,
        // sendGridResponse: logData.sendGridResponse || null,
      });
      
      // ✅ 記錄成功日誌
      log(`✅ [Email Service] 記錄郵件日誌成功 | LogID: ${logData.id}`, 'email');
    } catch (error) {
      // 如果數據庫記錄失敗，至少記錄到控制台
      console.error('❌ [Email Service] 記錄郵件日誌失敗:', error);
      log(`❌ [Email Service] 記錄郵件日誌失敗: ${error}`, 'email');
    }
  },

  /**
   * 獲取郵件日誌列表
   */
  async getEmailLogs(limit: number = 50) {
    try {
      const logs = await db
        .select()
        .from(emailLogs)
        .orderBy(desc(emailLogs.sent_at)) // 使用 sent_at 而不是 timestamp
        .limit(limit);

      return logs;
    } catch (error) {
      console.error('❌ [Email Service] 獲取郵件日誌失敗:', error);
      return [];
    }
  },

  /**
   * 根據 ID 獲取特定郵件日誌
   */
  async getEmailLogById(logId: string) {
    try {
      const logs = await db
        .select()
        .from(emailLogs)
        .where(eq(emailLogs.id, logId))
        .limit(1);

      return logs[0] || null;
    } catch (error) {
      console.error('❌ [Email Service] 獲取郵件日誌失敗:', error);
      return null;
    }
  },

  /**
   * 根據類型獲取郵件日誌
   */
  async getEmailLogsByType(type: string, limit: number = 50) {
    try {
      const logs = await db
        .select()
        .from(emailLogs)
        .where(eq(emailLogs.type, type))
        .orderBy(desc(emailLogs.sent_at)) // 使用 sent_at 而不是 timestamp
        .limit(limit);

      return logs;
    } catch (error) {
      console.error('❌ [Email Service] 獲取郵件日誌失敗:', error);
      return [];
    }
  },

  /**
   * 發送郵箱驗證郵件
   */
  async sendVerificationEmail(email: string, token: string): Promise<{
    success: boolean;
    logId: string;
    error?: string;
    errorCode?: string;
  }> {
    const appUrl = config.app.appUrl || config.app.clientUrl;
    const verificationLink = `${appUrl}/verify-email/${token}`; // ✅ 使用 /verify-email/{token} 格式
    
    const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>驗證您的郵箱 - FitBuddy</title>
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
    .link-box {
      background: #e9ecef;
      padding: 10px;
      border-radius: 4px;
      word-break: break-all;
      font-family: monospace;
      font-size: 12px;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📧 驗證您的郵箱</h1>
    </div>
    
    <div class="content">
      <p>您好！</p>
      
      <p>感謝您註冊 FitBuddy！請點擊下面的按鈕來驗證您的郵箱地址：</p>
      
      <div style="text-align: center;">
        <a href="${verificationLink}" class="button">驗證郵箱</a>
      </div>
      
      <p>如果按鈕無法點擊，請複製以下鏈接到瀏覽器中打開：</p>
      
      <div class="link-box">
        ${verificationLink}
      </div>
      
      <p style="color: #999; font-size: 12px; margin-top: 20px;">
        此驗證鏈接將在 24 小時後過期。如果您沒有註冊 FitBuddy 賬戶，請忽略此郵件。
      </p>
    </div>
    
    <div class="footer">
      <p>此郵件由 FitBuddy 自動發送，請勿回覆。</p>
      <p>如有問題，請聯繫：${config.email.sendgridSupportEmail}</p>
    </div>
  </div>
</body>
</html>
    `;

    return await this.sendEmail({
      to: email,
      subject: '驗證您的 FitBuddy 郵箱',
      html,
      type: 'verification',
    });
  },

  /**
   * 清除郵件日誌（可選，用於清理舊數據）
   */
  async clearEmailLogs(): Promise<void> {
    try {
      await db.delete(emailLogs).execute();
      log('✅ [Email Service] 郵件日誌已清除', 'email');
    } catch (error) {
      console.error('❌ [Email Service] 清除郵件日誌失敗:', error);
      log(`❌ [Email Service] 清除郵件日誌失敗: ${error}`, 'email');
    }
  },

  /**
   * 發送邀請郵件（向後兼容）
   */
  async sendInvitationEmail(
    recipientEmail: string,
    recipientName: string,
    coachName: string,
    invitationToken: string,
    coachProfileUrl?: string
  ): Promise<{ success: boolean; logId?: string; error?: string }> {
    try {
      const clientUrl = config.app.clientUrl || config.app.appUrl;
      const acceptInvitationUrl = `${clientUrl}/auth/accept-invitation/${invitationToken}`;
      const fromEmail = config.email.sendgridFromEmail;
      const supportEmail = config.email.sendgridSupportEmail || config.email.sendgridReplyTo;
      const templateId = config.email.sendgridTemplateId || undefined;

      const subject = `${coachName} 邀請你加入 FitBuddy 🏋️`;

      let html: string;
      if (templateId) {
        // 如果使用模板，需要通過 sendEmail 的 templateId 參數
        const result = await this.sendEmail({
          to: recipientEmail,
          subject,
          html: '', // 模板模式下不需要
          templateId,
          templateData: {
            recipientName,
            coachName,
            acceptInvitationUrl,
            coachProfileUrl: coachProfileUrl || '',
          },
          replyTo: supportEmail,
          type: 'invitation',
        });
        return result;
      } else {
        // 使用自定義 HTML
        html = this.generateInvitationTemplate(
          recipientName,
          coachName,
          acceptInvitationUrl,
          coachProfileUrl
        );

        const result = await this.sendEmail({
          to: recipientEmail,
          subject,
          html,
          replyTo: supportEmail,
          type: 'invitation',
        });
        return result;
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '發送邀請郵件失敗'
      };
    }
  },

  /**
   * 生成邀請郵件 HTML 模板
   */
  generateInvitationTemplate(
    recipientName: string,
    coachName: string,
    acceptInvitationUrl: string,
    coachProfileUrl?: string
  ): string {
    const supportEmail = config.email.sendgridSupportEmail || config.email.sendgridReplyTo || 'support@fitbuddy.hk';
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
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #22c55e;
      margin-bottom: 10px;
    }
    h1 {
      color: #1a1a1a;
      font-size: 24px;
      margin: 0;
    }
    .content {
      margin: 30px 0;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
    }
    .message {
      background-color: #f9fafb;
      border-left: 4px solid #22c55e;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .button {
      display: inline-block;
      background-color: #22c55e;
      color: #ffffff;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #16a34a;
    }
    .coach-info {
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 6px;
      margin: 20px 0;
      text-align: center;
    }
    .coach-name {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 10px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 14px;
      color: #6b7280;
    }
    .link {
      color: #22c55e;
      word-break: break-all;
    }
    .warning {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 14px;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏋️ FitBuddy</div>
      <h1>你收到了一個邀請</h1>
    </div>
    
    <div class="content">
      <div class="greeting">
        親愛的 ${recipientName}，
      </div>
      
      <div class="message">
        <strong>${coachName}</strong> 邀請你加入 FitBuddy，成為他們的客戶。
      </div>
      
      ${coachProfileUrl ? `
      <div class="coach-info">
        <div class="coach-name">${coachName}</div>
        <p style="margin: 0; color: #6b7280;">你的專屬教練</p>
      </div>
      ` : ''}
      
      <div class="button-container">
        <a href="${acceptInvitationUrl}" class="button">接受邀請</a>
      </div>
      
      <div class="warning">
        <strong>⚠️ 注意：</strong> 此邀請將在 30 天後過期。如果你無法點擊按鈕，請複製以下鏈接到瀏覽器：
        <br><br>
        <a href="${acceptInvitationUrl}" class="link">${acceptInvitationUrl}</a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        如果你不認識 ${coachName} 或不想接受此邀請，可以安全地忽略此郵件。
      </p>
    </div>
    
    <div class="footer">
      <p>此郵件由 FitBuddy 系統自動發送，請勿直接回覆。</p>
      <p>如有疑問，請聯繫：<a href="mailto:${supportEmail}" style="color: #22c55e;">${supportEmail}</a></p>
      <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
        © ${new Date().getFullYear()} FitBuddy. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();
  },
};

// 導出向後兼容的函數
export async function sendInvitationEmail(
  clientEmail: string,
  clientName: string,
  coachName: string,
  invitationLink: string
): Promise<void> {
  // 從 invitationLink 中提取 token
  const tokenMatch = invitationLink.match(/\/auth\/accept-invitation\/([^\/]+)/);
  const invitationToken = tokenMatch ? tokenMatch[1] : invitationLink.split('/').pop() || '';
  
  const result = await emailService.sendInvitationEmail(
    clientEmail,
    clientName,
    coachName,
    invitationToken
  );

  // 如果發送失敗，記錄錯誤但不拋出異常（避免影響邀請創建流程）
  if (!result.success) {
    log(`⚠️  [Email Service] 邀請郵件發送失敗，但邀請記錄已創建 | LogID: ${result.logId || 'N/A'} | 錯誤: ${result.error}`, 'email');
  }
}

export default emailService;
