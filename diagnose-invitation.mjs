import { db } from './server/db.ts';

async function diagnose() {
  console.log('🔍 FitBuddy 邀請功能診斷\n');
  
  try {
    console.log('1️⃣  === USERS 表 ===');
    const users = await db.query.users.findMany();
    console.log(`總用戶數: ${users.length}`);
    users.forEach(u => {
      console.log(`  - ${u.id}: ${u.email} (${u.role})`);
    });
    
    console.log('\n2️⃣  === INVITATIONS 表 ===');
    const invitations = await db.query.invitations.findMany();
    console.log(`總邀請數: ${invitations.length}`);
    invitations.forEach(inv => {
      console.log(`  - ID: ${inv.id}`);
      console.log(`    從: ${inv.coach_id} 到: ${inv.client_id}`);
      console.log(`    狀態: ${inv.status}`);
    });
    
    console.log('\n3️⃣  === COACH_CLIENT_RELATIONSHIPS 表 ===');
    const relationships = await db.query.coach_client_relationships.findMany();
    console.log(`總關係數: ${relationships.length}`);
    relationships.forEach(rel => {
      console.log(`  - Coach: ${rel.coach_id}, Client: ${rel.client_id}, Status: ${rel.status}`);
    });
    
    console.log('\n4️⃣  === 數據一致性檢查 ===');
    const invalidInvitations = invitations.filter(inv => 
      !users.some(u => u.id === inv.coach_id)
    );
    if (invalidInvitations.length > 0) {
      console.log(`⚠️  ${invalidInvitations.length} 個邀請的 coach_id 無效`);
    } else {
      console.log('✅ 所有邀請的 coach_id 都有效');
    }
    
    console.log('\n📊 === 總結 ===');
    console.log(`用戶: ${users.length}`);
    console.log(`邀請: ${invitations.length}`);
    console.log(`關係: ${relationships.length}`);
    
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    console.error(error);
  }
}

diagnose();
