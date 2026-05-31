/**
 * 連到 Neon：找出 public 下所有 coach_id 欄位，若非 integer 則檢查資料後改為 integer
 * 執行：npx tsx server/scripts/fix-coach-id-columns.ts（專案根目錄）
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

// 1. 找出 public schema 下所有 column_name = 'coach_id' 的欄位
const listCoachIdColumns = `
  SELECT table_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'coach_id'
  ORDER BY table_name;
`;

type CoachIdColumn = { table_name: string; data_type: string };

async function main() {
  const altered: string[] = [];
  const skipped: { table: string; reason: string; rows?: any[] }[] = [];

  console.log('\n========== 1. public schema 下所有 coach_id 欄位 ==========\n');

  const listResult = await pool.query<CoachIdColumn>(listCoachIdColumns);
  if (listResult.rows.length === 0) {
    console.log('沒有找到 coach_id 欄位。');
    await pool.end();
    return;
  }

  const table = listResult.rows.map((r) => ({ table: r.table_name, type: r.data_type }));
  console.table(table);

  const nonInteger = listResult.rows.filter((r) => r.data_type !== 'integer');
  if (nonInteger.length === 0) {
    console.log('\n所有 coach_id 已是 integer，無需修改。');
    await pool.end();
    return;
  }

  console.log('\n========== 2. 處理 data_type 非 integer 的 coach_id ==========\n');

  for (const { table_name } of nonInteger) {
    const safeTable = `"${table_name.replace(/"/g, '""')}"`;

    // 2.1 檢查資料
    const countResult = await pool.query(
      `SELECT
        COUNT(*)::int AS total_rows,
        COUNT(*) FILTER (WHERE coach_id::text ~ '^\\d+$')::int AS numeric_rows,
        COUNT(*) FILTER (WHERE coach_id IS NOT NULL AND coach_id::text !~ '^\\d+$')::int AS non_numeric_rows
       FROM ${safeTable}`
    );
    const { total_rows, numeric_rows, non_numeric_rows } = countResult.rows[0];

    console.log(`表 ${table_name}: total=${total_rows}, numeric=${numeric_rows}, non_numeric=${non_numeric_rows}`);

    if (Number(non_numeric_rows) > 0) {
      const sampleResult = await pool.query(
        `SELECT coach_id FROM ${safeTable} WHERE coach_id IS NOT NULL AND coach_id::text !~ '^\\d+$' LIMIT 10`
      );
      skipped.push({
        table: table_name,
        reason: `non_numeric_rows = ${non_numeric_rows}，無法自動轉 integer`,
        rows: sampleResult.rows.map((r) => r.coach_id),
      });
      console.log(`  → 跳過：有 ${non_numeric_rows} 筆非數字，範例 coach_id:`, sampleResult.rows.map((r) => r.coach_id));
      continue;
    }

    // 2.2 non_numeric_rows = 0，執行 ALTER
    try {
      await pool.query(
        `ALTER TABLE ${safeTable} ALTER COLUMN coach_id TYPE integer USING coach_id::integer`
      );
      altered.push(table_name);
      console.log(`  → 已改為 integer`);
    } catch (err: any) {
      skipped.push({ table: table_name, reason: err.message || String(err) });
      console.log(`  → 失敗:`, err.message);
    }
  }

  console.log('\n========== 3. 總結 ==========\n');
  console.log('成功改為 integer 的 table:');
  console.log(altered.length ? altered.join(', ') : '(無)');
  console.log('\n無法修改的 table 及原因:');
  if (skipped.length) {
    skipped.forEach((s) => {
      console.log(`  - ${s.table}: ${s.reason}`);
      if (s.rows?.length) console.log(`    範例 coach_id: ${s.rows.join(', ')}`);
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
