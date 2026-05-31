#!/usr/bin/env node
/**
 * 環境變量配置檢查腳本
 * 
 * 檢查必需的環境變量是否已設置
 * 
 * 使用方法：
 *   node scripts/check-env.js
 *   或
 *   npm run env:check
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加載環境變量（與 server/config/env.ts 保持一致）
const rootEnv = path.resolve(__dirname, '../.env');
const rootEnvLocal = path.resolve(__dirname, '../.env.local');
const serverEnvLocal = path.resolve(__dirname, '../server/.env.local');

dotenv.config({ path: rootEnv });
dotenv.config({ path: rootEnvLocal });
dotenv.config({ path: serverEnvLocal });

// 必需的環境變量列表
const requiredVars = {
  // 數據庫
  DATABASE_URL: '數據庫連接字符串',
  
  // JWT
  JWT_SECRET: 'JWT 簽名密鑰',
  REFRESH_TOKEN_SECRET: 'Refresh Token 密鑰',
  
  // Session
  SESSION_SECRET: 'Session 加密密鑰',
  
  // Google OAuth（如果使用）
  GOOGLE_CLIENT_ID: 'Google OAuth Client ID',
  GOOGLE_CLIENT_SECRET: 'Google OAuth Client Secret',
};

// 可選但建議設置的變量
const recommendedVars = {
  SENDGRID_API_KEY: 'SendGrid API Key（郵件服務）',
  GOOGLE_CALLBACK_URL: 'Google OAuth 回調 URL',
};

// 檢查環境變量
const missing = [];
const recommended = [];

console.log('🔍 檢查環境變量配置...\n');

// 檢查必需的變量
for (const [key, description] of Object.entries(requiredVars)) {
  const value = process.env[key];
  if (!value || value === '') {
    missing.push({ key, description });
  } else {
    console.log(`✅ ${key}: 已設置`);
  }
}

// 檢查建議的變量
for (const [key, description] of Object.entries(recommendedVars)) {
  const value = process.env[key];
  if (!value || value === '') {
    recommended.push({ key, description });
  } else {
    console.log(`✅ ${key}: 已設置`);
  }
}

// 輸出結果
console.log('\n' + '='.repeat(60));

if (missing.length === 0 && recommended.length === 0) {
  console.log('✅ 所有環境變量配置完整！');
  process.exit(0);
}

if (missing.length > 0) {
  console.log('\n❌ 缺少必需的環境變量：');
  missing.forEach(({ key, description }) => {
    console.log(`   - ${key}: ${description}`);
  });
  console.log('\n💡 請在 server/.env.local 中設置這些變量');
  console.log('   參考 .env.example 文件');
}

if (recommended.length > 0) {
  console.log('\n⚠️  建議設置的環境變量：');
  recommended.forEach(({ key, description }) => {
    console.log(`   - ${key}: ${description}`);
  });
}

console.log('\n' + '='.repeat(60));
console.log('\n📋 配置文件位置：');
console.log(`   - 後端: server/.env.local`);
console.log(`   - 前端: client/.env.local`);
console.log(`   - 範本: .env.example`);

if (missing.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
