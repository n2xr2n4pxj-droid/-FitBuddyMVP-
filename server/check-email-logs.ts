import { pool } from './db';

async function checkEmailLogs() {
  try {
    console.log('📊 查詢 email_logs 表...\n');
    
    // 先檢查表結構
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'email_logs'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 表結構:');
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
    });
    
    console.log('\n📧 最近的郵件日誌 (前 5 條):');
    const result = await pool.query(
      `SELECT id, recipient_email, subject, type, status, sent_at, created_at
       FROM email_logs 
       ORDER BY created_at DESC 
       LIMIT 5`
    );
    
    if (result.rows.length === 0) {
      console.log('  (沒有記錄)');
    } else {
      result.rows.forEach((row, index) => {
        console.log(`\n  [${index + 1}]`);
        console.log(`    ID: ${row.id}`);
        console.log(`    收件人: ${row.recipient_email}`);
        console.log(`    主題: ${row.subject}`);
        console.log(`    類型: ${row.type || 'N/A'}`);
        console.log(`    狀態: ${row.status}`);
        console.log(`    發送時間: ${row.sent_at}`);
        console.log(`    創建時間: ${row.created_at}`);
      });
    }
    
    // 統計信息
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        COUNT(CASE WHEN type = 'invitation' THEN 1 END) as invitation_count,
        COUNT(CASE WHEN type = 'verification' THEN 1 END) as verification_count
      FROM email_logs
    `);
    
    if (statsResult.rows.length > 0) {
      const stats = statsResult.rows[0];
      console.log('\n📈 統計信息:');
      console.log(`  總記錄數: ${stats.total}`);
      console.log(`  已發送: ${stats.sent_count}`);
      console.log(`  失敗: ${stats.failed_count}`);
      console.log(`  邀請郵件: ${stats.invitation_count || 0}`);
      console.log(`  驗證郵件: ${stats.verification_count || 0}`);
    }
    
  } catch (error: any) {
    console.error('❌ 查詢失敗:', error.message);
    if (error.code) {
      console.error('   錯誤代碼:', error.code);
    }
    if (error.detail) {
      console.error('   詳細信息:', error.detail);
    }
    process.exit(1);
  }
}

checkEmailLogs()
  .then(() => {
    console.log('\n✨ 查詢完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 腳本執行失敗:', error);
    process.exit(1);
  });

