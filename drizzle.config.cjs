const dotenv = require('dotenv');
const path = require('path');

// 加載環境變量（與 server/index.ts 和 server/db.ts 保持一致）
dotenv.config({ path: path.resolve(__dirname, 'server', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Please check your .env file.');
}

// defineConfig 實際上只是返回配置對象本身，所以我們可以直接返回配置
// 這樣可以避免 CommonJS/ESM 模組系統的兼容性問題
module.exports = {
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};

