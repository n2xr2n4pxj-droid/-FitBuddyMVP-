import { db } from '../db';
import { invitations } from '../db/schema';

/**
 * Migration: 清空 invitations 資料表，為 sender_id / receiver_id 切換成 UUID/varchar 做準備。
 *
 * 說明：
 * - 早期 invitations.sender_id / receiver_id 使用 INTEGER，且與 users.id (UUID/varchar) 不一致。
 * - 新 schema 已改為 varchar + FK 到 users.id，舊資料無法安全轉換，因此這支腳本會先清空 invitations。
 * - 目前邀請功能仍在開發階段，清空不會影響正式使用者資料。
 */
async function migrateToUUID() {
  console.log('🚀 Migration: 清空 invitations (為 sender_id / receiver_id 改為 UUID 做準備)');

  const existing = await db.select().from(invitations);
  console.log(`📊 現有邀請數量: ${existing.length}`);

  if (existing.length > 0) {
    await db.delete(invitations);
    console.log('✅ 已清空 invitations table');
  } else {
    console.log('✅ 無資料需清空');
  }

  console.log('✅ 接下來請執行: npm run db:push');
}

migrateToUUID().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exitCode = 1;
});

