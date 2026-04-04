import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { users } from "../db/schema";
import { hashPassword } from "../replitAuth";

const TEST_ACCOUNTS = [
  {
    email: "coach@fitbuddy.hk",
    name: "Gordon Coach",
    role: "COACH",
    password: "password123",
  },
  {
    email: "client@fitbuddy.hk",
    name: "Amy Client",
    role: "CLIENT",
    password: "password123",
  },
  {
    email: "both@fitbuddy.hk",
    name: "Ben Both",
    role: "COACH",
    password: "password123",
  },
] as const;

type DbRole = "USER" | "COACH" | "ADMIN";

function normalizeRole(role: string): DbRole {
  const upper = role.toUpperCase();
  if (upper === "CLIENT") return "USER";
  if (upper === "COACH" || upper === "ADMIN" || upper === "USER") {
    return upper as DbRole;
  }
  if (upper === "BOTH") {
    return "COACH";
  }
  return "USER";
}

function splitName(name: string): { firstName: string; lastName: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? name, lastName: null };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

async function seed(): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const account of TEST_ACCOUNTS) {
    const email = account.email.trim().toLowerCase();
    const role = normalizeRole(account.role);

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      skipped += 1;
      console.log(`⏭️ 已存在，略過：${email}`);
      continue;
    }

    const passwordHash = hashPassword(account.password);
    const { firstName, lastName } = splitName(account.name);

    await db.insert(users).values({
      email,
      passwordHash,
      role,
      emailVerified: true,
      firstName,
      lastName,
    });

    created += 1;
    console.log(`✅ 已建立：${email} (${account.role})`);
  }

  console.log(`Seed 完成：建立 ${created} 個 / 跳過 ${skipped} 個`);
}

seed()
  .catch((error) => {
    console.error("❌ Seed 失敗：", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
