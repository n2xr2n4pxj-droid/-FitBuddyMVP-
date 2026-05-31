/**
 * 執行 align-uuid-fks.sql，使 DB 與 server/db/schema.ts 的 UUID 外鍵一致。
 * 會載入 server/.env.local 的 DATABASE_URL。
 *
 * 使用方式：npx tsx server/scripts/run-align-uuid-fks.ts
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_PATH = resolve(__dirname, 'align-uuid-fks.sql');

async function main() {
  const sql = readFileSync(SQL_PATH, 'utf-8');
  console.log('執行 align-uuid-fks.sql ...');
  await pool.query(sql);
  console.log('✅ 遷移完成。請重新執行 e2e 測試。');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ 遷移失敗:', err);
  process.exitCode = 1;
  pool.end();
});
