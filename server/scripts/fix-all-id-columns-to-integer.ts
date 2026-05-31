/**
 * 連到 Neon：將 public 下所有應為 integer 的 *_id 欄位（非 users.id）改為 integer
 * 涵蓋：coach_id, client_id, user_id, sender_id, receiver_id, user1_id, user2_id
 * 執行：npx tsx server/scripts/fix-all-id-columns-to-integer.ts（專案根目錄）
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

// 應為 integer 的欄位名（與 schema 一致；不含 users.id）
const ID_COLUMNS = [
  'coach_id',
  'client_id',
  'user_id',
  'sender_id',
  'receiver_id',
  'user1_id',
  'user2_id',
];

type Row = { table_name: string; column_name: string; data_type: string };

async function main() {
  const altered: string[] = [];
  const skipped: { table: string; column: string; reason: string; rows?: any[] }[] = [];

  const placeholders = ID_COLUMNS.map((_, i) => `$${i + 1}`).join(', ');
  const listQuery = `
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN (${placeholders})
    ORDER BY table_name, column_name;
  `;

  console.log('\n========== 1. public 下所有應為 integer 的 *_id 欄位 ==========\n');

  const listResult = await pool.query<Row>(listQuery, ID_COLUMNS);
  if (listResult.rows.length === 0) {
    console.log('沒有找到符合的欄位。');
    await pool.end();
    return;
  }

  console.table(listResult.rows.map((r) => ({ table: r.table_name, column: r.column_name, type: r.data_type })));

  const nonInteger = listResult.rows.filter((r) => r.data_type !== 'integer');
  if (nonInteger.length === 0) {
    console.log('\n所有欄位已是 integer，無需修改。');
    await pool.end();
    return;
  }

  console.log('\n========== 2. 處理 data_type 非 integer 的欄位 ==========\n');

  for (const { table_name, column_name } of nonInteger) {
    const safeTable = `"${table_name.replace(/"/g, '""')}"`;
    const safeCol = `"${column_name.replace(/"/g, '""')}"`;

    const countResult = await pool.query(
      `SELECT
        COUNT(*)::int AS total_rows,
        COUNT(*) FILTER (WHERE ${safeCol}::text ~ '^\\d+$')::int AS numeric_rows,
        COUNT(*) FILTER (WHERE ${safeCol} IS NOT NULL AND ${safeCol}::text !~ '^\\d+$')::int AS non_numeric_rows
       FROM ${safeTable}`
    );
    const { total_rows, numeric_rows, non_numeric_rows } = countResult.rows[0];

    const label = `${table_name}.${column_name}`;
    console.log(`${label}: total=${total_rows}, numeric=${numeric_rows}, non_numeric=${non_numeric_rows}`);

    if (Number(non_numeric_rows) > 0) {
      const sampleResult = await pool.query(
        `SELECT ${safeCol} FROM ${safeTable} WHERE ${safeCol} IS NOT NULL AND ${safeCol}::text !~ '^\\d+$' LIMIT 10`
      );
      const samples = sampleResult.rows.map((r: any) => r[column_name]);
      skipped.push({
        table: table_name,
        column: column_name,
        reason: `non_numeric_rows = ${non_numeric_rows}，無法自動轉 integer`,
        rows: samples,
      });
      console.log(`  → 跳過：範例 ${column_name}:`, samples);
      continue;
    }

    try {
      await pool.query(
        `ALTER TABLE ${safeTable} ALTER COLUMN ${safeCol} TYPE integer USING ${safeCol}::integer`
      );
      altered.push(label);
      console.log(`  → 已改為 integer`);
    } catch (err: any) {
      skipped.push({ table: table_name, column: column_name, reason: err.message || String(err) });
      console.log(`  → 失敗:`, err.message);
    }
  }

  console.log('\n========== 3. 總結 ==========\n');
  console.log('成功改為 integer 的 table.column:');
  console.log(altered.length ? altered.join(', ') : '(無)');
  console.log('\n無法修改的 table.column 及原因:');
  if (skipped.length) {
    skipped.forEach((s) => {
      console.log(`  - ${s.table}.${s.column}: ${s.reason}`);
      if (s.rows?.length) console.log(`    範例: ${s.rows.join(', ')}`);
    });
  } else {
    console.log('  (無)');
  }
  console.log('');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
