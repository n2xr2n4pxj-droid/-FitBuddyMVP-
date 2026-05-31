import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // 1. 清除所有 Cookies (清除 Session)
  await page.context().clearCookies();

  // 2. 清除 LocalStorage 與 SessionStorage (清除 Zustand 持久化狀態)
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // 3. 強制跳轉到登入頁，確保測試起點一致
  await page.goto('/login');

  // 4. 【關鍵】等待登入表單元素出現，確保路由守衛沒有把我們踢走
  await page.waitForSelector('#email', { state: 'visible', timeout: 5000 });
});

// ─────────────────────────────────────────
// Case A：JSON 污染攻擊
// ─────────────────────────────────────────
test('Case A: 注入損壞 JSON → fetchMe 守衛 → 強制 logout', async ({ page }) => {
  // 注入缺少 registrationComplete 的損壞 user 物件
  await page.goto('/');
  await page.evaluate(() => {
    const corrupted = {
      state: {
        token: 'fake-token-123',
        user: { id: 'user-1', email: 'test@test.com' }, // 缺少 roles + registrationComplete
        isAuthenticated: true,
        registrationComplete: false,
      },
      version: 0,
    };
    localStorage.setItem('fitbuddy-auth-store', JSON.stringify(corrupted));
  });

  // 重新整理，觸發 fetchMe 守衛
  await page.reload();

  // 預期：validateUserData 失敗 → logout → 導向登入頁
  await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

  // 確認 localStorage 已清空
  const token = await page.evaluate(() =>
    localStorage.getItem('fitbuddy-auth-store')
  );
  const parsed = token ? JSON.parse(token) : null;
  expect(parsed?.state?.token).toBeNull();
});

// ─────────────────────────────────────────
// Case B：殭屍狀態清理
// ─────────────────────────────────────────
test('Case B: pendingCoachRef 連續失敗 3 次 → 殭屍狀態自動清除', async ({ page }) => {
  // 攔截 applyCoachRef API，回傳 400（避免 apiClient 5xx 重試延遲）
  await page.route('**/api/auth/apply-coach-ref', route =>
    route.fulfill({ status: 400, body: JSON.stringify({ error: 'Bad Request' }) })
  );

  // 預先設定殭屍狀態（已失敗 2 次，再失敗一次就該清除）
  await page.evaluate(() => {
    localStorage.setItem('pendingCoachRef', 'ZOMBIE-REF-123');
    localStorage.setItem('coachRefRetryCount', '2');
  });

  // 執行登入（需要有測試帳號，或 mock API）
  await page.route('**/api/auth/login', route =>
    (console.log('✅ LOGIN MOCK HIT'),
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'valid-token',
        user: {
          id: 'user-1',
          email: 'test@fitbuddy.com',
          role: 'client',
          roles: ['client'],
          firstName: 'Test',
          lastName: 'User',
          registrationComplete: true,
        },
      }),
    }))
  );

  const submitBtn = page.getByRole('button', { name: /登入|登入中\.\.\./ });
  const coachRefReq = page.waitForRequest('**/api/auth/apply-coach-ref');
  await page.fill('#email', 'test@fitbuddy.com');
  await page.fill('#password', 'password123');
  await submitBtn.click();

  // 等待 _handleCoachRefSequence 的 API call 真正發生
  await coachRefReq;

  // 驗證殭屍狀態已清除
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('pendingCoachRef')))
    .toBeNull();
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('coachRefRetryCount')))
    .toBeNull();
});

// ─────────────────────────────────────────
// Case C：雙擊防護
// ─────────────────────────────────────────
test('Case C: 快速連點登入按鈕 → 只發出一個 API 請求', async ({ page }) => {
  let apiCallCount = 0;

  await page.route('**/api/auth/login', route => {
    console.log('✅ LOGIN MOCK HIT');
    apiCallCount++;
    // 故意延遲回應，模擬網路慢
    return new Promise(resolve =>
      setTimeout(() =>
        resolve(route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: 'valid-token',
            user: {
              id: 'user-1',
              email: 'test@fitbuddy.com',
              role: 'client',
              registrationComplete: true,
            },
          }),
        })),
        500  // 延遲 500ms
      )
    );
  });

  await page.fill('#email', 'test@fitbuddy.com');
  await page.fill('#password', 'password123');

  // 快速觸發三次 submit（避免按鈕 disabled 造成 click timeout）
  await page.locator('form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  // 驗證：executionLock 確保只發出 1 個請求
  await expect.poll(() => apiCallCount).toBe(1);
});
