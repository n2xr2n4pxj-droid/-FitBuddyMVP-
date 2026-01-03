/**
 * 為教練創建預定義邀請模板
 * 
 * 運行方式: npx tsx server/seed-invitation-templates.ts [coachId]
 * 如果不提供 coachId，則為所有教練創建模板
 */

import 'dotenv/config';
import { db } from './db';
import { invitationTemplates, users } from './db/schema';
import { eq, or } from 'drizzle-orm';

const DEFAULT_TEMPLATES = [
  {
    name: '激勵模板',
    message: '嗨！我是你的健身教練，很高興能通過 FitBuddy 幫助你達成健身目標！讓我們一起努力，打造更健康、更強壯的自己。我相信你可以做到！💪'
  },
  {
    name: '正式模板',
    message: '您好，我是您的健身教練。我誠摯地邀請您加入 FitBuddy 平台，成為我的客戶。我將根據您的個人情況，為您制定專業的訓練計劃和營養建議，幫助您實現健身目標。期待與您合作！'
  },
  {
    name: '簡潔模板',
    message: '你好！我是你的健身教練，邀請你加入 FitBuddy。讓我們一起開始你的健身之旅！'
  }
];

async function seedTemplates(coachId?: number) {
  try {
    console.log('🟡 開始創建邀請模板...');

    let coaches: { id: number }[] = [];

    if (coachId) {
      // 為指定教練創建
      const [coach] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, coachId))
        .limit(1);

      if (!coach) {
        console.error(`❌ 找不到 ID 為 ${coachId} 的教練`);
        return;
      }

      coaches = [coach];
    } else {
      // 為所有教練創建
      // 使用原始 SQL 查詢，因為 role 可能是字符串或枚舉
      const { pool } = await import('./db');
      const result = await pool.query(`
        SELECT id FROM users 
        WHERE role IN ('COACH', 'BOTH', 'ADMIN') 
        OR UPPER(role) IN ('COACH', 'BOTH', 'ADMIN')
      `);
      
      const allCoaches = result.rows.map((row: any) => ({ id: parseInt(row.id) }));

      coaches = allCoaches;
      console.log(`🟡 找到 ${coaches.length} 位教練`);
    }

    for (const coach of coaches) {
      console.log(`🟡 為教練 ${coach.id} 創建模板...`);

      // 檢查是否已有模板
      const existing = await db
        .select()
        .from(invitationTemplates)
        .where(eq(invitationTemplates.coachId, coach.id))
        .limit(1);

      if (existing.length > 0) {
        console.log(`⏭️  教練 ${coach.id} 已有模板，跳過`);
        continue;
      }

      // 創建預定義模板
      for (const template of DEFAULT_TEMPLATES) {
        await db.insert(invitationTemplates).values({
          coachId: coach.id,
          name: template.name,
          message: template.message,
          isDefault: false,
        });
        console.log(`  ✅ 創建模板: ${template.name}`);
      }
    }

    console.log('✅ 模板創建完成！');
  } catch (error) {
    console.error('❌ 創建模板時出錯:', error);
    throw error;
  }
}

// 從命令行參數獲取 coachId
const coachIdArg = process.argv[2];
const coachId = coachIdArg ? parseInt(coachIdArg, 10) : undefined;

if (coachIdArg && isNaN(coachId!)) {
  console.error('❌ 無效的教練 ID');
  process.exit(1);
}

seedTemplates(coachId)
  .then(() => {
    console.log('🎉 完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  });

