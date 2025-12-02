import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

// 加載環境變量
dotenv.config();

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
