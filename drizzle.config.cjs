const path = require('path');
const dotenv = require('dotenv');

// 加載環境變量：與 server 意圖一致
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, 'server', '.env.local'), override: true });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Please check your .env file.');
}

module.exports = {
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};
