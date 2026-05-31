# 架構符合性檢查報告

## 架構要求

### 註冊流程（/register）
- Google OAuth/Apple OAuth/email → 新用戶 → `/register?step=3`
- Google OAuth/Apple OAuth/email → 現有用戶 → 提示 + 跳到登入頁

### 登入流程（/login）
- Google OAuth/Apple OAuth/email → 新用戶 → 提示 + 跳到註冊頁 `/register?step=1`
- Google OAuth/Apple OAuth/email → 現有用戶 → `/dashboard`

---

## 檢查結果

### ✅ Google OAuth - **完全符合**

#### 註冊流程（flow='register'）
- ✅ **新用戶**：創建用戶 → `isNewUser=true` → 重定向到 `/register?step=3`
- ✅ **現有用戶**：返回 `409 USER_ALREADY_EXISTS` → 顯示錯誤 → 重定向到 `/login`

**實現位置**：
- 後端：`server/routes/auth.ts` 第 1125-1144 行（提前檢查）
- 前端：`client/src/components/GoogleLoginButton.tsx` 第 60-71 行（錯誤處理）

#### 登入流程（flow='login'）
- ✅ **現有用戶**：直接登入 → `isNewUser=false` → 重定向到 `/dashboard`
- ✅ **新用戶**：返回 `404 USER_NOT_FOUND` → 顯示錯誤 → 重定向到 `/register?step=1`

**實現位置**：
- 後端：`server/routes/auth.ts` 第 1125-1144 行（提前檢查）
- 前端：`client/src/components/GoogleLoginButton.tsx` 第 73-84 行（錯誤處理）

---

### ⚠️ Email 註冊 - **部分符合，需要修復**

#### 當前狀態
- ✅ **新用戶**：創建用戶 → 進入註冊流程
- ⚠️ **現有用戶**：返回 `409`，但錯誤格式與 Google OAuth 不一致

#### 問題
1. **後端錯誤格式不一致**：
   - 當前：`res.status(409).json({ message: 'Email already registered' })`
   - 應該：`res.status(409).json({ error: 'USER_ALREADY_EXISTS', message: '你的帳戶已註冊，請使用登入功能' })`

2. **前端錯誤處理缺失**：
   - 當前：`useRegister()` mutation 只記錄錯誤，沒有重定向邏輯
   - 應該：檢測 `USER_ALREADY_EXISTS` 錯誤 → 顯示提示 → 重定向到 `/login`

**需要修復的位置**：
- 後端：`server/routes/auth.ts` 第 127 行
- 前端：`client/src/services/authService.ts` 第 157 行（`useRegister` mutation）

---

### ⚠️ Email 登入 - **部分符合，需要修復**

#### 當前狀態
- ✅ **現有用戶**：登入成功 → 重定向到 `/dashboard`
- ⚠️ **新用戶**：返回 `401 Invalid credentials`，但未區分「用戶不存在」和「密碼錯誤」

#### 問題
1. **後端錯誤格式不一致**：
   - 當前：`res.status(401).json({ message: 'Invalid credentials' })`（統一錯誤訊息）
   - 應該：區分用戶不存在 → `res.status(404).json({ error: 'USER_NOT_FOUND', message: '你的帳戶並未註冊，請先註冊' })`

2. **前端錯誤處理缺失**：
   - 當前：`LoginPage` 只顯示錯誤 toast，沒有重定向邏輯
   - 應該：檢測 `USER_NOT_FOUND` 錯誤 → 顯示提示 → 重定向到 `/register?step=1`

**需要修復的位置**：
- 後端：`server/routes/auth.ts` 第 232 行（區分用戶不存在和密碼錯誤）
- 前端：`client/src/pages/auth/LoginPage.tsx` 第 115-132 行（錯誤處理）

---

### ❌ Apple OAuth - **尚未實現**

#### 當前狀態
- ⚠️ 只有佔位符按鈕：`alert('OAuth coming soon')`
- ❌ 沒有實際的 Apple OAuth 實現

#### 需要實現
1. 後端：添加 `/api/auth/apple/callback` 端點（類似 Google OAuth）
2. 前端：創建 `AppleLoginButton` 組件（類似 `GoogleLoginButton`）
3. 支持 `flow` 參數和錯誤處理（與 Google OAuth 一致）

**位置**：
- 前端：`client/src/pages/auth/RegisterFlow/Step2EmailPassword.tsx` 第 145-147 行
- 需要創建：`client/src/components/AppleLoginButton.tsx`

---

## 修復建議

### 優先級 1：Email 註冊錯誤處理

**後端修復** (`server/routes/auth.ts` 第 127 行)：
```typescript
// 修改前
return res.status(409).json({ message: 'Email already registered' });

// 修改後
return res.status(409).json({ 
  error: 'USER_ALREADY_EXISTS',
  message: '你的帳戶已註冊，請使用登入功能',
  email: email,
});
```

**前端修復** (`client/src/services/authService.ts` 第 157 行)：
```typescript
export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterData) => authService.register(data),
    onError: (error: any) => {
      console.error('Registration error:', error);
      
      // 處理用戶已存在的情況
      if (error?.response?.status === 409 || error?.response?.data?.error === 'USER_ALREADY_EXISTS') {
        // 顯示錯誤並重定向到登入頁面
        setTimeout(() => {
          window.location.replace('/login');
        }, 1000);
      }
    },
  });
}
```

### 優先級 2：Email 登入錯誤處理

**後端修復** (`server/routes/auth.ts` 第 230-233 行)：
```typescript
// 修改前
if (!user) {
  return res.status(401).json({ message: 'Invalid credentials' });
}

// 修改後
if (!user) {
  return res.status(404).json({ 
    error: 'USER_NOT_FOUND',
    message: '你的帳戶並未註冊，請先註冊',
    email: email,
  });
}
```

**前端修復** (`client/src/pages/auth/LoginPage.tsx` 第 115-132 行)：
```typescript
onError: (err: any) => {
  // 處理用戶不存在的情況
  if (err?.response?.status === 404 || err?.response?.data?.error === 'USER_NOT_FOUND') {
    toast({
      title: '帳戶不存在',
      description: err?.response?.data?.message || '你的帳戶並未註冊，請先註冊',
      variant: 'destructive',
    });
    setTimeout(() => {
      setLocation('/register?step=1');
    }, 1000);
    return;
  }
  
  // 其他錯誤處理...
}
```

### 優先級 3：Apple OAuth 實現

需要完整實現 Apple OAuth 流程（參考 Google OAuth 實現）。

---

## 總結

| 功能 | 狀態 | 備註 |
|------|------|------|
| Google OAuth 註冊 | ✅ 完全符合 | 無需修改 |
| Google OAuth 登入 | ✅ 完全符合 | 無需修改 |
| Email 註冊 | ⚠️ 部分符合 | 需要修復錯誤處理 |
| Email 登入 | ⚠️ 部分符合 | 需要區分錯誤類型並修復錯誤處理 |
| Apple OAuth | ❌ 未實現 | 需要完整實現 |

**建議修復順序**：
1. Email 註冊錯誤處理（優先級 1）
2. Email 登入錯誤處理（優先級 2）
3. Apple OAuth 實現（優先級 3）
