/**
 * Email Admin Routes - 郵件管理 API
 * 
 * 提供郵件調試和管理功能，僅限管理員訪問
 */

import express, { Request, Response, RequestHandler } from "express";
import emailService from "../services/emailService";
import { authMiddleware } from "../middleware/auth";
import { pool } from "../db";

const router = express.Router();

/**
 * 管理員權限檢查中間件
 */
const requireAdmin: RequestHandler = async (req: any, res: Response, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未認證' });
    }

    const userId = req.user.id || req.user.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: '未認證' });
    }

    // 從數據庫查詢用戶角色
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用戶不存在' });
    }

    const userRole = (result.rows[0].role || '').toUpperCase();
    
    // 只有 ADMIN 可以訪問
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ error: '需要管理員權限' });
    }

    next();
  } catch (error) {
    console.error('❌ [requireAdmin] 中間件錯誤:', error);
    res.status(500).json({ error: '服務器錯誤' });
  }
};

/**
 * 🏥 健康檢查端點
 * GET /api/admin/email/health
 */
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    sendgridConfigured: !!process.env.SENDGRID_API_KEY,
  });
});

/**
 * ⚙️ 獲取郵件配置
 * GET /api/admin/email/config
 */
router.get("/config", authMiddleware, requireAdmin, async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@fitbuddy.hk',
        replyTo: process.env.SENDGRID_REPLY_TO || process.env.SENDGRID_SUPPORT_EMAIL || 'support@fitbuddy.hk',
        supportEmail: process.env.SENDGRID_SUPPORT_EMAIL || process.env.SENDGRID_REPLY_TO || 'support@fitbuddy.hk',
        appUrl: process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173',
        sendgridConfigured: !!process.env.SENDGRID_API_KEY,
        templateId: process.env.SENDGRID_TEMPLATE_ID || null,
      }
    });
  } catch (error) {
    console.error('❌ [Email Admin] 獲取配置失敗:', error);
    res.status(500).json({ 
      success: false,
      error: '獲取配置失敗' 
    });
  }
});

/**
 * 📧 發送測試郵件
 * POST /api/admin/email/test-send
 * 
 * 請求體:
 * {
 *   "to": "test@example.com",
 *   "subject": "Test Subject",
 *   "html": "<p>Test content</p>",
 *   "text": "Test content (optional)"
 * }
 */
router.post("/test-send", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { to, subject, html, text } = req.body;

    // 驗證輸入
    if (!to || !subject || !html) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: to, subject, html',
        errorCode: 'MISSING_FIELDS'
      });
    }

    // 驗證郵箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: '郵箱格式無效',
        errorCode: 'INVALID_EMAIL'
      });
    }

    // 發送測試郵件
    const result = await emailService.sendEmail({
      to,
      subject,
      html,
      text,
      type: "TEST",
    });

    if (result.success) {
      res.json({
        success: true,
        message: '測試郵件發送成功',
        logId: result.logId,
        data: {
          logId: result.logId,
          timestamp: new Date().toISOString(),
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || '郵件發送失敗',
        errorCode: result.errorCode || 'EMAIL_SEND_FAILED',
        logId: result.logId,
        message: `郵件發送失敗: ${result.error}`
      });
    }
  } catch (error: any) {
    console.error('❌ [Email Admin] 發送測試郵件失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message || '發送測試郵件失敗',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 📋 獲取郵件日誌列表
 * GET /api/admin/email/logs?limit=50&type=invitation
 */
router.get("/logs", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const type = req.query.type as string | undefined;

    let logs;
    if (type) {
      logs = await emailService.getEmailLogsByType(type, limit);
    } else {
      logs = await emailService.getEmailLogs(limit);
    }

    res.json({
      success: true,
      data: logs,
      total: logs.length,
      limit,
      type: type || 'all'
    });
  } catch (error) {
    console.error('❌ [Email Admin] 獲取日誌失敗:', error);
    res.status(500).json({
      success: false,
      error: '獲取日誌失敗'
    });
  }
});

/**
 * 📄 獲取特定日誌詳細信息
 * GET /api/admin/email/logs/:logId
 */
router.get("/logs/:logId", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { logId } = req.params;
    
    if (!logId) {
      return res.status(400).json({
        success: false,
        error: '缺少 logId 參數'
      });
    }

    const log = await emailService.getEmailLogById(logId);

    if (!log) {
      return res.status(404).json({
        success: false,
        error: '日誌不存在'
      });
    }

    // 解析 JSON 字段以便展示
    const enrichedLog = {
      ...log,
      errorDetails: log.errorDetails ? JSON.parse(log.errorDetails) : null,
      sendGridResponse: log.sendGridResponse ? JSON.parse(log.sendGridResponse) : null
    };

    res.json({
      success: true,
      data: enrichedLog
    });
  } catch (error: any) {
    console.error('❌ [Email Admin] 獲取日誌詳情失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message || '獲取日誌詳情失敗'
    });
  }
});

/**
 * 📊 獲取郵件統計（向後兼容）
 * GET /api/admin/email/stats
 */
router.get("/stats", authMiddleware, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const allLogs = await emailService.getEmailLogs(1000); // 獲取足夠多的日誌來統計
    
    const stats = {
      total: allLogs.length,
      success: allLogs.filter(log => log.success).length,
      failed: allLogs.filter(log => !log.success).length,
      byType: {} as Record<string, { total: number; success: number; failed: number }>,
      recent: allLogs.slice(0, 10).map(log => ({
        id: log.id,
        type: log.type,
        to: log.to,
        subject: log.subject,
        success: log.success,
        timestamp: log.timestamp
      }))
    };

    // 按類型統計
    allLogs.forEach(log => {
      if (!stats.byType[log.type]) {
        stats.byType[log.type] = { total: 0, success: 0, failed: 0 };
      }
      stats.byType[log.type].total++;
      if (log.success) {
        stats.byType[log.type].success++;
      } else {
        stats.byType[log.type].failed++;
      }
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ [Email Admin] 獲取統計失敗:', error);
    res.status(500).json({
      success: false,
      error: '獲取統計失敗'
    });
  }
});

/**
 * 🗑️ 清除郵件日誌（謹慎使用）
 * POST /api/admin/email/clear-logs
 */
router.post("/clear-logs", authMiddleware, requireAdmin, async (_req: Request, res: Response) => {
  try {
    await emailService.clearEmailLogs();
    res.json({ 
      success: true, 
      message: '日誌已清除' 
    });
  } catch (error) {
    console.error('❌ [Email Admin] 清除日誌失敗:', error);
    res.status(500).json({
      success: false,
      error: '清除日誌失敗'
    });
  }
});

export default router;
