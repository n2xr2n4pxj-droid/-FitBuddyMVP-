/**
 * 緊急修復腳本：創建缺失的數據庫表
 * 運行方式：tsx server/create-missing-tables.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加載環境變量（與 server/index.ts 保持一致）
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

async function createMissingTables() {
  try {
    console.log('🟡 連接到數據庫...');
    
    // 檢查表是否存在
    const checkTable = async (tableName: string): Promise<boolean> => {
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );`,
        [tableName]
      );
      return result.rows[0].exists;
    };

    const invitationsExists = await checkTable('invitations');
    const relationshipsExists = await checkTable('coach_client_relationships');

    console.log(`📊 invitations 表: ${invitationsExists ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`📊 coach_client_relationships 表: ${relationshipsExists ? '✅ 存在' : '❌ 不存在'}`);

    if (invitationsExists && relationshipsExists) {
      console.log('✅ 所有表都已存在，無需創建！');
      await pool.end();
      return;
    }

    // 讀取遷移文件
    const migrationPath = path.resolve(__dirname, '..', 'drizzle', '0000_bizarre_slyde.sql');
    console.log(`📖 讀取遷移文件: ${migrationPath}`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // 分割語句
    const statements = migrationSQL.split('--> statement-breakpoint');
    
    let executed = 0;
    
    // 第一步：創建所需的枚舉類型
    console.log('🔨 創建枚舉類型...');
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      
      // 創建枚舉類型（如果不存在）
      if (trimmed.includes('CREATE TYPE') && 
          (trimmed.includes('invitation_status') || trimmed.includes('relationship_status'))) {
        try {
          await pool.query(trimmed);
          console.log(`✅ 枚舉類型創建成功: ${trimmed.substring(0, 50)}...`);
        } catch (error: any) {
          if (error.code === '42P07') {
            // 類型已存在，忽略
            console.log(`ℹ️  枚舉類型已存在，跳過`);
          } else {
            throw error;
          }
        }
      }
    }
    
    // 第二步：創建表
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      
      // 只執行創建這兩個表的語句
      if (trimmed.includes('CREATE TABLE "invitations"') && !invitationsExists) {
        console.log('🔨 創建 invitations 表...');
        await pool.query(trimmed);
        executed++;
        console.log('✅ invitations 表創建成功！');
      }
      
      if (trimmed.includes('CREATE TABLE "coach_client_relationships"') && !relationshipsExists) {
        console.log('🔨 創建 coach_client_relationships 表...');
        await pool.query(trimmed);
        executed++;
        console.log('✅ coach_client_relationships 表創建成功！');
      }
    }
    
    // 第三步：創建外鍵約束
    console.log('🔨 創建外鍵約束...');
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      
      if (trimmed.includes('ALTER TABLE "invitations"') && !invitationsExists) {
        try {
          await pool.query(trimmed);
        } catch (error: any) {
          console.warn(`⚠️  外鍵約束創建警告: ${error.message}`);
        }
      }
      
      if (trimmed.includes('ALTER TABLE "coach_client_relationships"') && !relationshipsExists) {
        try {
          await pool.query(trimmed);
        } catch (error: any) {
          console.warn(`⚠️  外鍵約束創建警告: ${error.message}`);
        }
      }
    }
    
    // 第四步：創建索引
    console.log('🔨 創建索引...');
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      
      if (trimmed.includes('CREATE INDEX') && 
          (trimmed.includes('invitations_') || trimmed.includes('coach_client_relationships_'))) {
        try {
          await pool.query(trimmed);
        } catch (error: any) {
          if (error.code === '42P07') {
            // 索引已存在，忽略
          } else {
            console.warn(`⚠️  索引創建警告: ${error.message}`);
          }
        }
      }
    }
    
    if (executed === 0) {
      console.log('⚠️  未執行任何操作');
    } else {
      console.log(`✅ 成功創建 ${executed} 個表！`);
    }
    
  } catch (error: any) {
    console.error('❌ 錯誤:', error.message);
    console.error('詳細信息:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createMissingTables();

