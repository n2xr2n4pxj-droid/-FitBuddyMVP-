#!/usr/bin/env node
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
    const res = await client.query(`
      SELECT 
        t.table_name, 
        c.column_name, 
        c.data_type,
        c.column_default
      FROM information_schema.columns c
      JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
      WHERE t.table_schema = 'public'
        AND c.column_default LIKE '%nextval%'
      ORDER BY t.table_name, c.column_name
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
