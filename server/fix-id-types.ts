/**
 * 緊急修復：將 coach_client_relationships 和 invitations 表的 ID 字段改為 INTEGER
 * 以匹配 users.id 的類型
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

async function fixIdTypes() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔧 開始修復 ID 字段類型...\n');
    
    // 1. 修復 coach_client_relationships 表
    console.log('1️⃣ 修復 coach_client_relationships 表...');
    
    // 檢查是否有數據
    const ccrCount = await client.query('SELECT COUNT(*) FROM coach_client_relationships');
    const hasCcrData = parseInt(ccrCount.rows[0].count) > 0;
    
    if (hasCcrData) {
      console.log('   ⚠️  表中有數據，需要先處理數據...');
      // 如果 coach_id 或 client_id 是字符串，需要轉換
      // 但這很複雜，我們先假設表中沒有數據或數據都是有效的整數字符串
      console.log('   ⚠️  請確保 coach_id 和 client_id 的值可以轉換為整數！');
    }
    
    // 刪除外鍵約束
    console.log('   🔨 刪除外鍵約束...');
    try {
      await client.query('ALTER TABLE coach_client_relationships DROP CONSTRAINT IF EXISTS coach_client_relationships_coach_id_users_id_fk');
      await client.query('ALTER TABLE coach_client_relationships DROP CONSTRAINT IF EXISTS coach_client_relationships_client_id_users_id_fk');
    } catch (error: any) {
      console.log('   ℹ️  外鍵約束可能不存在:', error.message);
    }
    
    // 刪除索引
    console.log('   🔨 刪除索引...');
    try {
      await client.query('DROP INDEX IF EXISTS coach_client_relationships_coach_idx');
      await client.query('DROP INDEX IF EXISTS coach_client_relationships_client_idx');
      await client.query('DROP INDEX IF EXISTS coach_client_relationships_unique');
    } catch (error: any) {
      console.log('   ℹ️  索引可能不存在:', error.message);
    }
    
    // 轉換字段類型
    console.log('   🔨 轉換 coach_id 為 INTEGER...');
    await client.query(`
      ALTER TABLE coach_client_relationships 
      ALTER COLUMN coach_id TYPE INTEGER USING coach_id::INTEGER
    `);
    
    console.log('   🔨 轉換 client_id 為 INTEGER...');
    await client.query(`
      ALTER TABLE coach_client_relationships 
      ALTER COLUMN client_id TYPE INTEGER USING client_id::INTEGER
    `);
    
    // 重新創建索引
    console.log('   🔨 重新創建索引...');
    await client.query('CREATE INDEX IF NOT EXISTS coach_client_relationships_coach_idx ON coach_client_relationships(coach_id)');
    await client.query('CREATE INDEX IF NOT EXISTS coach_client_relationships_client_idx ON coach_client_relationships(client_id)');
    await client.query('CREATE INDEX IF NOT EXISTS coach_client_relationships_status_idx ON coach_client_relationships(status)');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS coach_client_relationships_unique ON coach_client_relationships(coach_id, client_id)');
    
    // 重新創建外鍵約束
    console.log('   🔨 重新創建外鍵約束...');
    await client.query(`
      ALTER TABLE coach_client_relationships 
      ADD CONSTRAINT coach_client_relationships_coach_id_users_id_fk 
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
    `);
    
    await client.query(`
      ALTER TABLE coach_client_relationships 
      ADD CONSTRAINT coach_client_relationships_client_id_users_id_fk 
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
    `);
    
    console.log('   ✅ coach_client_relationships 表修復完成！\n');
    
    // 2. 修復 invitations 表
    console.log('2️⃣ 修復 invitations 表...');
    
    // 檢查是否有數據
    const invCount = await client.query('SELECT COUNT(*) FROM invitations');
    const hasInvData = parseInt(invCount.rows[0].count) > 0;
    
    if (hasInvData) {
      console.log('   ⚠️  表中有數據，需要先處理數據...');
      console.log('   ⚠️  請確保 sender_id 和 receiver_id 的值可以轉換為整數！');
    }
    
    // 刪除外鍵約束
    console.log('   🔨 刪除外鍵約束...');
    try {
      await client.query('ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_sender_id_users_id_fk');
      await client.query('ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_receiver_id_users_id_fk');
    } catch (error: any) {
      console.log('   ℹ️  外鍵約束可能不存在:', error.message);
    }
    
    // 刪除索引
    console.log('   🔨 刪除索引...');
    try {
      await client.query('DROP INDEX IF EXISTS invitations_sender_idx');
    } catch (error: any) {
      console.log('   ℹ️  索引可能不存在:', error.message);
    }
    
    // 轉換字段類型
    console.log('   🔨 轉換 sender_id 為 INTEGER...');
    await client.query(`
      ALTER TABLE invitations 
      ALTER COLUMN sender_id TYPE INTEGER USING sender_id::INTEGER
    `);
    
    // receiver_id 可能為 NULL，需要特殊處理
    console.log('   🔨 轉換 receiver_id 為 INTEGER...');
    await client.query(`
      ALTER TABLE invitations 
      ALTER COLUMN receiver_id TYPE INTEGER USING 
        CASE 
          WHEN receiver_id IS NULL OR receiver_id = '' THEN NULL
          ELSE receiver_id::INTEGER
        END
    `);
    
    // 重新創建索引
    console.log('   🔨 重新創建索引...');
    await client.query('CREATE INDEX IF NOT EXISTS invitations_sender_idx ON invitations(sender_id)');
    
    // 重新創建外鍵約束
    console.log('   🔨 重新創建外鍵約束...');
    await client.query(`
      ALTER TABLE invitations 
      ADD CONSTRAINT invitations_sender_id_users_id_fk 
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    `);
    
    await client.query(`
      ALTER TABLE invitations 
      ADD CONSTRAINT invitations_receiver_id_users_id_fk 
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    `);
    
    console.log('   ✅ invitations 表修復完成！\n');
    
    await client.query('COMMIT');
    console.log('✅ 所有 ID 字段類型修復完成！');
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ 錯誤:', error.message);
    console.error('詳細信息:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixIdTypes().catch(console.error);

