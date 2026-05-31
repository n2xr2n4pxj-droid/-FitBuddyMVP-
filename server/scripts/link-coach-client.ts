/**
 * 手動補一筆教練–學員關聯（寫入 coach_clients，與邀請接受後一致）。
 *
 * 用法：
 *   npx tsx server/scripts/link-coach-client.ts <coachUserId> <clientUserId>
 *
 * 僅列出使用者（查 id）：
 *   npx tsx server/scripts/link-coach-client.ts --list
 */
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { coachClients, users } from "../db/schema";

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--list" || args.length === 0) {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .orderBy(users.email)
      .limit(50);
    console.log("最近 50 位使用者（請複製 id）：");
    for (const r of rows) {
      console.log(`  ${r.id}  ${String(r.email)}  role=${r.role}`);
    }
    if (args[0] !== "--list" && args.length === 0) {
      console.log("\n然後執行：");
      console.log("  npx tsx server/scripts/link-coach-client.ts <coachId> <clientId>");
    }
    process.exit(0);
    return;
  }

  const [coachId, clientId] = args.map((s) => String(s).trim());
  if (!coachId || !clientId) {
    console.error("需要兩個參數：coachUserId clientUserId");
    process.exit(1);
  }

  const [existing] = await db
    .select({ id: coachClients.id })
    .from(coachClients)
    .where(and(eq(coachClients.coachId, coachId), eq(coachClients.clientId, clientId)))
    .limit(1);

  if (existing) {
    await db
      .update(coachClients)
      .set({ status: "active" })
      .where(eq(coachClients.id, existing.id));
    console.log("已存在同一組合，已將 status 更新為 active：", existing.id);
    process.exit(0);
    return;
  }

  const [inserted] = await db
    .insert(coachClients)
    .values({
      coachId,
      clientId,
      status: "active",
    })
    .returning({ id: coachClients.id, coachId: coachClients.coachId, clientId: coachClients.clientId });

  console.log("已新增 coach_clients：", inserted);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
