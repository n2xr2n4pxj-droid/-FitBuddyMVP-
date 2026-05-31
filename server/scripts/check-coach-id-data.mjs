#!/usr/bin/env node
/**
 * Check coach_id column data: total_rows, numeric_rows, non_numeric_rows per table.
 * Run: node server/scripts/check-coach-id-data.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const tablesRes = await client.query(`
      SELECT c.table_name, c.data_type
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.column_name = 'coach_id'
      ORDER BY c.table_name
    `);

    if (tablesRes.rows.length === 0) {
      console.log('No tables with coach_id found.');
      return;
    }

    console.log('table_name                    | total_rows | numeric_rows | non_numeric_rows');
    console.log('-'.repeat(75));

    let allNonNumericZero = true;
    for (const { table_name, data_type } of tablesRes.rows) {
      const safeTable = `"${table_name}"`;
      if (data_type === 'integer') {
        const r = await client.query(`SELECT COUNT(*)::int as total FROM ${safeTable}`);
        const total = r.rows[0].total;
        console.log(`${table_name.padEnd(28)} | ${String(total).padStart(10)} | ${String(total).padStart(12)} | ${String(0).padStart(14)}`);
        continue;
      }
      const r = await client.query(`
        SELECT
          COUNT(*)::int AS total_rows,
          COUNT(CASE WHEN coach_id::text ~ '^\\d+$' THEN 1 END)::int AS numeric_rows,
          COUNT(CASE WHEN coach_id IS NULL OR coach_id::text !~ '^\\d+$' THEN 1 END)::int AS non_numeric_rows
        FROM ${safeTable}
      `);
      const row = r.rows[0];
      if (row.non_numeric_rows !== '0' && Number(row.non_numeric_rows) !== 0) allNonNumericZero = false;
      console.log(
        `${table_name.padEnd(28)} | ${String(row.total_rows).padStart(10)} | ${String(row.numeric_rows).padStart(12)} | ${String(row.non_numeric_rows).padStart(14)}`
      );
    }

    console.log('-'.repeat(75));
    console.log(allNonNumericZero ? 'All coach_id values are numeric (non_numeric_rows = 0). Safe to convert.' : 'Some tables have non-numeric coach_id; review before converting.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
