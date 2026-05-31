/**
 * Authentication Middleware
 * 
 * 提供認證和授權中間件
 */

import type { RequestHandler } from 'express';
import { verifyJWT } from '../replitAuth';
import { sendError } from '../lib/response';
import { ErrorCodes } from '@shared/error-codes';

/**
 * 認證中間件 - 確保用戶已登錄
 */
export const authMiddleware: RequestHandler = verifyJWT;

/**
 * 教練專用中間件 - 確保用戶是教練
 */
export const coachOnly: RequestHandler = async (req: any, res, next) => {
  try {
    // 先通過認證檢查
    if (!req.user) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, '未認證');
    }

    const userId = req.user.id || req.user.claims?.sub;
    if (!userId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, '未認證');
    }

    // 從數據庫重新查詢用戶角色（確保獲取最新角色）
    const { pool } = await import('../db');
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, ErrorCodes.NOT_FOUND, '用戶不存在');
    }

    const userRole = (result.rows[0].role || '').toUpperCase();
    
    // 數據庫枚舉: USER, COACH, ADMIN
    if (userRole !== 'COACH') {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, '僅教練可訪問此資源');
    }

    next();
  } catch (error) {
    console.error('❌ [coachOnly] 中間件錯誤:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, '服務器錯誤');
  }
};

/**
 * 客戶專用中間件 - 確保用戶是客戶
 */
export const clientOnly: RequestHandler = async (req: any, res, next) => {
  try {
    // 先通過認證檢查
    if (!req.user) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, '未認證');
    }

    // 檢查用戶角色（支持枚舉值）
    const userRole = (req.user.role || req.user.claims?.role || '').toUpperCase();
    
    // 數據庫枚舉: USER, COACH, ADMIN
    if (userRole !== 'USER') {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, '僅客戶可訪問此資源');
    }

    next();
  } catch (error) {
    console.error('❌ [clientOnly] 中間件錯誤:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, '服務器錯誤');
  }
};

