import { Resend } from 'resend';
import crypto from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { emailLogs } from '../db/schema';
import { log } from '../vite';
import { config } from '../config/env';

const resend = new Resend(process.env.RESEND_API_KEY);
const DEFAULT_FROM = 'onboarding@resend.dev';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  type?: string;
}

interface EmailLog {
  id: string;
  type: string;
  to: string;
  subject: string;
  success: boolean;
  error?: string | null;
  messageId?: string | null;
  timestamp: Date;
}

export const emailService = {
  async initialize() {
    if (!process.env.RESEND_API_KEY) {
      log('⚠️  [Email Service] RESEND_API_KEY 未設置，郵件功能將無法使用', 'email');
      return;
    }
    log('✅ [Email Service] Resend 已初始化', 'email');
  },

  async sendEmail(options: SendEmailOptions): Promise<{
    success: boolean;
    logId: string;
    error?: string;
    errorCode?: string;
  }> {
    const logId = crypto.randomUUID();
    const emailType = options.type || 'general';

    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured');
      }

      const response = await resend.emails.send({
        from: DEFAULT_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo || config.email.replyTo || config.email.supportEmail,
      });

      const messageId = response?.data?.id ?? null;
      await this.logEmail({
        id: logId,
        type: emailType,
        to: options.to,
        subject: options.subject,
        success: true,
        messageId,
        timestamp: new Date(),
      });

      log(`✅ [Email Service] 郵件已發送 | LogID: ${logId} | MessageID: ${messageId || 'N/A'}`, 'email');
      return { success: true, logId };
    } catch (error: any) {
      const errorMessage = error?.message || '郵件服務寄送失敗';
      const errorCode = String(error?.statusCode || error?.status || 'INTERNAL_ERROR');

      await this.logEmail({
        id: logId,
        type: emailType,
        to: options.to,
        subject: options.subject,
        success: false,
        error: errorMessage,
        timestamp: new Date(),
      });

      log(`❌ [Email Service] 郵件發送失敗 | LogID: ${logId} | 錯誤: ${errorMessage}`, 'email');
      return {
        success: false,
        logId,
        error: errorMessage,
        errorCode,
      };
    }
  },

  async logEmail(logData: EmailLog): Promise<void> {
    try {
      await db.insert(emailLogs).values({
        id: logData.id,
        type: logData.type || 'general',
        recipient_email: logData.to,
        subject: logData.subject,
        message_id: logData.messageId || null,
        status: logData.success ? 'sent' : 'failed',
        error_message: logData.error || null,
        sent_at: logData.timestamp,
      });
      log(`✅ [Email Service] 記錄郵件日誌成功 | LogID: ${logData.id}`, 'email');
    } catch (error) {
      console.error('❌ [Email Service] 記錄郵件日誌失敗:', error);
    }
  },

  async getEmailLogs(limit = 50) {
    try {
      return await db
        .select()
        .from(emailLogs)
        .orderBy(desc(emailLogs.sent_at))
        .limit(limit);
    } catch (error) {
      console.error('❌ [Email Service] 獲取郵件日誌失敗:', error);
      return [];
    }
  },

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

  async getEmailLogsByType(type: string, limit = 50) {
    try {
      return await db
        .select()
        .from(emailLogs)
        .where(eq(emailLogs.type, type))
        .orderBy(desc(emailLogs.sent_at))
        .limit(limit);
    } catch (error) {
      console.error('❌ [Email Service] 獲取郵件日誌失敗:', error);
      return [];
    }
  },

  async sendVerificationEmail(email: string, token: string): Promise<{
    success: boolean;
    logId: string;
    error?: string;
    errorCode?: string;
  }> {
    const appUrl = config.app.appUrl || config.app.clientUrl;
    const verificationLink = `${appUrl}/verify-email/${token}`;
    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #111827; line-height: 1.6;">
  <h2>驗證你的 FitBuddy 郵箱</h2>
  <p>請點擊以下按鈕完成郵箱驗證：</p>
  <p><a href="${verificationLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;">驗證郵箱</a></p>
  <p>若按鈕失效，請直接開啟：${verificationLink}</p>
</div>`;

    return await this.sendEmail({
      to: email,
      subject: '驗證你的 FitBuddy 郵箱',
      html,
      type: 'verification',
    });
  },

  async clearEmailLogs(): Promise<void> {
    try {
      await db.delete(emailLogs).execute();
      log('✅ [Email Service] 郵件日誌已清除', 'email');
    } catch (error) {
      console.error('❌ [Email Service] 清除郵件日誌失敗:', error);
    }
  },
};

export async function sendInvitationEmail(
  clientEmail: string,
  clientName: string,
  coachName: string,
  invitationLink: string
): Promise<void> {
  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #111827; line-height: 1.6;">
  <h2>FitBuddy 邀請</h2>
  <p>${coachName} 邀請 ${clientName} 加入 FitBuddy。</p>
  <p><a href="${invitationLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;">接受邀請</a></p>
</div>`;

  const result = await emailService.sendEmail({
    to: clientEmail,
    subject: `${coachName} 邀請你加入 FitBuddy`,
    html,
    type: 'invitation',
  });

  if (!result.success) {
    log(`⚠️  [Email Service] 邀請郵件發送失敗 | LogID: ${result.logId || 'N/A'} | 錯誤: ${result.error}`, 'email');
  }
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const result = await emailService.sendEmail({
      to,
      subject,
      html,
      type: 'manual_test',
    });

    if (!result.success) {
      throw new Error(result.error || '郵件服務寄送失敗');
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Resend 發送失敗:', error);
    throw new Error('郵件服務寄送失敗');
  }
}

export default emailService;
