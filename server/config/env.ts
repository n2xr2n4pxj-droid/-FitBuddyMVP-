/**
 * FitBuddy 環境變量管理系統
 * 
 * 統一管理所有環境變量，提供類型安全的配置對象
 * 包含驗證邏輯，確保生產環境必需的變量都已設置
 * 
 * 使用說明：
 * 1. 在項目根目錄創建 .env 文件（參考 .env.example）
 * 2. 所有 secrets 必須從環境變量讀取，不得硬編碼
 * 3. 生產環境啟動前會自動驗證必需的環境變量
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加載 .env 文件（按優先級順序，後加載的會覆蓋先加載的）
// 1. 系統環境變量（最低優先級，生產環境使用）
// 2. 項目根目錄的 .env（回退）
// 3. 項目根目錄的 .env.local（回退）
// 4. server/.env.local（最高優先級，本地開發用，不提交到 Git）
// 
// 注意：dotenv.config() 不會覆蓋已存在的環境變量，所以先加載優先級低的
const rootEnv = path.resolve(__dirname, '../../.env');
const rootEnvLocal = path.resolve(__dirname, '../../.env.local');
const serverEnvLocal = path.resolve(__dirname, '../.env.local');

// 按優先級從低到高加載（後加載的會覆蓋先加載的）
dotenv.config({ path: rootEnv });
dotenv.config({ path: rootEnvLocal });
dotenv.config({ path: serverEnvLocal });

/**
 * 獲取環境變量的輔助函數
 * @param key 環境變量名稱
 * @param defaultValue 默認值（可選）
 * @returns 環境變量值或默認值
 */
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return '';
  }
  return value;
}

/**
 * 獲取必需的環境變量
 * @param key 環境變量名稱
 * @throws 如果變量不存在則拋出錯誤
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value || value === '') {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * 應用配置
 */
export const config = {
  // ========== 應用基本配置 ==========
  app: {
    env: getEnv('NODE_ENV', 'development'),
    port: parseInt(getEnv('PORT', '3000'), 10),
    clientUrl: getEnv('CLIENT_URL', 'http://localhost:5173'),
    appUrl: getEnv('APP_URL', 'http://localhost:5173'),
  },

  // ========== 數據庫配置 ==========
  database: {
    url: getEnv('DATABASE_URL', ''),
    password: getEnv('DATABASE_PASSWORD', ''), // 如果單獨存儲密碼
  },

  // ========== Google OAuth 配置 ==========
  google: {
    clientId: getEnv('GOOGLE_CLIENT_ID', ''),
    clientSecret: getEnv('GOOGLE_CLIENT_SECRET', ''),
    callbackUrl: getEnv('GOOGLE_CALLBACK_URL', ''),
  },

  // ========== JWT 配置 ==========
  jwt: {
    secret: getEnv('JWT_SECRET', ''),
    refreshSecret: getEnv('REFRESH_TOKEN_SECRET', ''),
    accessTokenExpiration: getEnv('ACCESS_TOKEN_EXPIRATION', '7d'),
    refreshTokenExpiration: getEnv('REFRESH_TOKEN_EXPIRATION', '30d'),
  },

  // ========== Session 配置 ==========
  session: {
    secret: getEnv('SESSION_SECRET', ''),
  },

  // ========== CORS 配置 ==========
  cors: {
    origin: getEnv('CORS_ORIGIN', 'http://localhost:5173'),
    credentials: true,
  },

  // ========== SMTP / SendGrid 配置 ==========
  email: {
    sendgridApiKey: getEnv('SENDGRID_API_KEY', ''),
    sendgridFromEmail: getEnv('SENDGRID_FROM_EMAIL', 'noreply@fitbuddy.hk'),
    sendgridReplyTo: getEnv('SENDGRID_REPLY_TO', ''),
    sendgridSupportEmail: getEnv('SENDGRID_SUPPORT_EMAIL', 'support@fitbuddy.hk'),
    sendgridTemplateId: getEnv('SENDGRID_TEMPLATE_ID', ''),
    
    // SMTP 配置（如果使用傳統 SMTP）
    smtpHost: getEnv('SMTP_HOST', ''),
    smtpPort: parseInt(getEnv('SMTP_PORT', '587'), 10),
    smtpUser: getEnv('SMTP_USER', ''),
    smtpPassword: getEnv('SMTP_PASSWORD', ''),
  },
};

/**
 * 驗證生產環境必需的環境變量
 * @throws 如果必需的變量未設置則拋出錯誤
 */
export function validateConfig(): void {
  const errors: string[] = [];
  const isProduction = config.app.env === 'production';

  // 生產環境必需檢查
  if (isProduction) {
    // 數據庫
    if (!config.database.url) {
      errors.push('DATABASE_URL is required in production');
    }

    // JWT Secrets（生產環境必須使用強密鑰）
    if (!config.jwt.secret || config.jwt.secret === 'dev-jwt-secret-key') {
      errors.push('JWT_SECRET must be set to a secure value in production');
    }
    if (!config.jwt.refreshSecret || config.jwt.refreshSecret === 'dev-refresh-token-secret-key') {
      errors.push('REFRESH_TOKEN_SECRET must be set to a secure value in production');
    }

    // Session Secret
    if (!config.session.secret || config.session.secret === 'dev-session-secret') {
      errors.push('SESSION_SECRET must be set to a secure value in production');
    }

    // Google OAuth（如果使用 Google 登入）
    // 注意：如果應用不使用 Google OAuth，可以跳過這些檢查
    // 這裡假設生產環境需要使用 Google OAuth
    if (!config.google.clientId) {
      errors.push('GOOGLE_CLIENT_ID is required in production (if using Google OAuth)');
    }
    if (!config.google.clientSecret) {
      errors.push('GOOGLE_CLIENT_SECRET is required in production (if using Google OAuth)');
    }

    // Email 配置（如果使用郵件功能）
    // 注意：如果應用不使用郵件功能，可以跳過這些檢查
    if (!config.email.sendgridApiKey) {
      console.warn('⚠️  SENDGRID_API_KEY is not set - email functionality will be disabled');
    }
  } else {
    // 開發環境警告
    if (!config.jwt.secret || config.jwt.secret === 'dev-jwt-secret-key') {
      console.warn('⚠️  Using default JWT_SECRET - this should be changed in production');
    }
    if (!config.session.secret || config.session.secret === 'dev-session-secret') {
      console.warn('⚠️  Using default SESSION_SECRET - this should be changed in production');
    }
    if (!config.database.url) {
      console.warn('⚠️  DATABASE_URL is not set - database operations will fail');
    }
  }

  // 如果有錯誤，拋出異常
  if (errors.length > 0) {
    const errorMessage = `❌ Environment variable validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  // 驗證通過
  if (isProduction) {
    console.log('✅ All required environment variables are set for production');
  } else {
    console.log('✅ Environment variables validated (development mode)');
  }
}

/**
 * 獲取當前配置的摘要（用於日誌，不包含敏感信息）
 */
export function getConfigSummary(): Record<string, any> {
  return {
    app: {
      env: config.app.env,
      port: config.app.port,
      clientUrl: config.app.clientUrl,
    },
    database: {
      url: config.database.url ? '***SET***' : 'NOT SET',
    },
    google: {
      clientId: config.google.clientId ? '***SET***' : 'NOT SET',
      clientSecret: config.google.clientSecret ? '***SET***' : 'NOT SET',
      callbackUrl: config.google.callbackUrl || 'NOT SET',
    },
    jwt: {
      secret: config.jwt.secret ? '***SET***' : 'NOT SET',
      refreshSecret: config.jwt.refreshSecret ? '***SET***' : 'NOT SET',
    },
    session: {
      secret: config.session.secret ? '***SET***' : 'NOT SET',
    },
    email: {
      sendgridApiKey: config.email.sendgridApiKey ? '***SET***' : 'NOT SET',
      sendgridFromEmail: config.email.sendgridFromEmail,
    },
  };
}

// 導出默認配置對象
export default config;
