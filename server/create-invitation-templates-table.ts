/**
 * 創建邀請模板表
 * 運行方式：npx tsx server/create-invitation-templates-table.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加載環境變量
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 未設置！');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createInvitationTemplatesTable() {
  try {
    console.log('🟡 開始創建 invitation_templates 表...');

    // 檢查表是否已存在
    const checkTable = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invitation_templates'
      );`
    );

    if (checkTable.rows[0].exists) {
      console.log('⏭️  invitation_templates 表已存在，跳過創建');
      return;
    }

    // 創建表
    await pool.query(`
      CREATE TABLE invitation_templates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);

    console.log('✅ invitation_templates 表已創建');

    // 創建索引
    await pool.query(`
      CREATE INDEX invitation_templates_coach_idx ON invitation_templates(coach_id);
    `);
    console.log('✅ 索引已創建');

    // 創建唯一約束 (coach_id, name)
    await pool.query(`
      CREATE UNIQUE INDEX invitation_templates_unique_coach_name 
      ON invitation_templates(coach_id, name);
    `);
    console.log('✅ 唯一索引已創建');

    console.log('🎉 invitation_templates 表創建完成！');
  } catch (error: any) {
    console.error('❌ 創建表時出錯:', error);
    if (error.code === '42P07') {
      console.log('⏭️  表已存在，跳過');
    } else {
      throw error;
    }
  } finally {
    await pool.end();
  }
}

createInvitationTemplatesTable()
  .then(() => {
    console.log('✅ 完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  });

