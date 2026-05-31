/**
 * 檢查數據庫中 ID 字段的實際類型
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

async function checkIdTypes() {
  try {
    console.log('🔍 檢查數據庫中 ID 字段的類型...\n');
    
    // 檢查 users.id
    const usersResult = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'id'
    `);
    
    if (usersResult.rows.length > 0) {
      const usersIdType = usersResult.rows[0];
      console.log('📊 users.id 類型:');
      console.log(`   數據類型: ${usersIdType.data_type}`);
      if (usersIdType.character_maximum_length) {
        console.log(`   長度: ${usersIdType.character_maximum_length}`);
      }
    } else {
      console.log('❌ users 表不存在或沒有 id 字段');
    }
    
    // 檢查 coach_client_relationships 表的字段
    const ccrResult = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'coach_client_relationships' 
        AND column_name IN ('coach_id', 'client_id')
      ORDER BY column_name
    `);
    
    if (ccrResult.rows.length > 0) {
      console.log('\n📊 coach_client_relationships 表字段:');
      ccrResult.rows.forEach(row => {
        console.log(`   ${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''}`);
      });
    } else {
      console.log('\n❌ coach_client_relationships 表不存在或沒有相關字段');
    }
    
    // 檢查 invitations 表的字段
    const invResult = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'invitations' 
        AND column_name IN ('sender_id', 'receiver_id')
      ORDER BY column_name
    `);
    
    if (invResult.rows.length > 0) {
      console.log('\n📊 invitations 表字段:');
      invResult.rows.forEach(row => {
        console.log(`   ${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''}`);
      });
    } else {
      console.log('\n❌ invitations 表不存在或沒有相關字段');
    }
    
    // 獲取一個實際的 user id 值來檢查
    const sampleUser = await pool.query('SELECT id FROM users LIMIT 1');
    if (sampleUser.rows.length > 0) {
      const sampleId = sampleUser.rows[0].id;
      console.log(`\n📝 示例 users.id 值: ${sampleId} (類型: ${typeof sampleId})`);
    }
    
  } catch (error: any) {
    console.error('❌ 錯誤:', error.message);
    console.error('詳細信息:', error);
  } finally {
    await pool.end();
  }
}

checkIdTypes();

