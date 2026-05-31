import { pool } from "../db";

async function migrateBothRoleToCoach(): Promise<void> {
  console.log("Starting role migration: BOTH -> COACH");

  const { rows } = await pool.query(
    `
      UPDATE users
      SET role = 'COACH', updated_at = NOW()
      WHERE UPPER(role::text) = 'BOTH'
      RETURNING id, email
    `,
  );

  console.log(`Migrated ${rows.length} users from BOTH to COACH`);
  for (const row of rows) {
    console.log(`- ${row.email} (${row.id})`);
  }

  // Keep a quick post-check for observability in deployment logs
  const check = await pool.query(
    `SELECT COUNT(*)::int AS count FROM users WHERE UPPER(role::text) = 'BOTH'`,
  );
  const remain = check.rows[0]?.count ?? 0;
  console.log(`Remaining BOTH roles: ${remain}`);
}

migrateBothRoleToCoach()
  .catch((error) => {
    console.error("Role migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
