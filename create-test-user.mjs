/**
 * 創建測試用戶腳本
 * 用法: node create-test-user.mjs
 */

import { hashPassword } from './server/replitAuth.js';
import { createUser } from './server/db/queries.js';

const testUser = {
  email: 'tt@test.com',
  password: 'ttt1234',
  firstName: 'Test',
  lastName: 'User',
  role: 'client',
};

async function createTestUser() {
  try {
    console.log('正在創建測試用戶...');
    console.log('Email:', testUser.email);
    console.log('Password:', testUser.password);

    const passwordHash = hashPassword(testUser.password);

    const user = await createUser({
      email: testUser.email,
      passwordHash,
      firstName: testUser.firstName,
      lastName: testUser.lastName,
      role: testUser.role,
    });

    if (user) {
      console.log('✅ 測試用戶創建成功！');
      console.log('用戶信息:', {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    } else {
      console.error('❌ 創建用戶失敗：未返回用戶對象');
    }
  } catch (error) {
    console.error('❌ 創建測試用戶時出錯:', error);
    if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
      console.log('ℹ️  用戶可能已存在，嘗試使用現有用戶登入');
    }
  }
}

createTestUser();

