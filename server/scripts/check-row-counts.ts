/**
 * 連到 Neon，查詢各表筆數
 * 執行：npx tsx server/scripts/check-row-counts.ts（專案根目錄）
 * 或：cd server && npx tsx scripts/check-row-counts.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 未設置');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const query = `
-- 檢查各表有沒有實際資料
SELECT 
  'users' as table_name, COUNT(*) as row_count 
FROM users
UNION ALL
SELECT 'meals', COUNT(*) FROM meals
UNION ALL
SELECT 'workouts', COUNT(*) FROM workouts
UNION ALL
SELECT 'coach_client_relationships', COUNT(*) FROM coach_client_relationships
UNION ALL
SELECT 'invitations', COUNT(*) FROM invitations
UNION ALL
SELECT 'progress_entries', COUNT(*) FROM progress_entries
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM activity_logs
UNION ALL
SELECT 'friendships', COUNT(*) FROM friendships
ORDER BY table_name;
`;

async function main() {
  try {
    const result = await pool.query(query);
    console.log('\n各表筆數：\n');
    console.table(result.rows);
    console.log('');
  } catch (err: any) {
    console.error('❌ 查詢失敗:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
