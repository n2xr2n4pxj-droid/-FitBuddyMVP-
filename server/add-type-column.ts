import { pool } from './db';

async function addTypeColumn() {
  try {
    console.log('🔧 添加 type 字段到 email_logs 表...');
    
    const result = await pool.query(
      `ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'general'`
    );
    
    console.log('✅ type 字段已添加');
    
    // 驗證字段是否添加成功
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'email_logs' 
      AND column_name = 'type'
    `);
    
    if (verifyResult.rows.length > 0) {
      const col = verifyResult.rows[0];
      console.log('\n📊 type 字段信息:');
      console.log(`  - 字段名: ${col.column_name}`);
      console.log(`  - 類型: ${col.data_type}`);
      console.log(`  - 默認值: ${col.column_default || 'none'}`);
      console.log(`  - 可空: ${col.is_nullable}`);
    } else {
      console.log('⚠️  警告: 無法驗證 type 字段是否添加成功');
    }
    
  } catch (error: any) {
    console.error('❌ 添加失敗:', error.message);
    if (error.code) {
      console.error('   錯誤代碼:', error.code);
    }
    if (error.detail) {
      console.error('   詳細信息:', error.detail);
    }
    process.exit(1);
  }
}

addTypeColumn()
  .then(() => {
    console.log('\n✨ 腳本執行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 腳本執行失敗:', error);
    process.exit(1);
  });

