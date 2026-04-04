# Google OAuth 流程診斷報告

## 1. 後端 - server/routes/auth.ts

### 回調端點
- **完整路徑**: `POST /api/auth/google/callback`
- **檔案**: `server/routes/auth.ts`（非 server/src/）
- **路由註冊**: `app.use("/api", authRoutes)` → 完整 URL 為 `/api/auth/google/callback`

### 處理流程 ✓

| 步驟 | 狀態 | 說明 |
|------|------|------|
| 接收參數 | ✓ | 接收 `{ code, clientId, flow }`（authorization code 流程） |
| 交換 Google Token | ✓ | 使用 `code` 向 `https://oauth2.googleapis.com/token` 換取 access_token |
| 取得用戶資訊 | ✓ | 用 access_token 呼叫 `https://www.googleapis.com/oauth2/v2/userinfo` |
| 建立/查找用戶 | ✓ | 新用戶建立紀錄，現有用戶更新頭像等 |
| 生成 JWT | ✓ | `generateAccessToken()` + `generateRefreshToken()` |
| 返回響應 | ✓ | 見下方格式 |

### 後端返回格式

```json
{
  "success": true,
  "message": "Google authentication successful",
  "token": "jwt-access-token-here",
  "refreshToken": "jwt-refresh-token-here",
  "isNewUser": false,
  "flow": "login",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "...",
    "lastName": "...",
    "avatar": "...",
    "role": "COACH",
    "emailVerified": true,
    "createdAt": "..."
  }
}
```

**重點**: 使用 `token` 欄位（非 `accessToken`），前端已支援兩者。

---

## 2. 前端 - Google 登入按鈕

### 組件位置
- **主組件**: `client/src/components/GoogleLoginButton.tsx`
- **登入頁**: `client/src/pages/auth/LoginPage.tsx` 使用 `<GoogleLoginButton flow="login" />`
- **註冊頁**: `client/src/pages/auth/RegisterFlow/Step2EmailPassword.tsx` 使用 `<GoogleLoginButton flow="register" />`
- **備用**: `client/src/pages/auth-login.tsx` 使用 `<GoogleLoginButton />`（預設 flow="login"）

### 處理流程 ✓

| 步驟 | 狀態 | 說明 |
|------|------|------|
| 觸發 Google 登入 | ✓ | `useGoogleLogin({ flow: 'auth-code' })` 取得 authorization code |
| 發送給後端 | ✓ | `fetch('/api/auth/google/callback', { method: 'POST', body: { code, clientId, flow } })` |
| 提取 token | ✓ | `data.accessToken || data.token`（支援兩種欄位名） |
| 保存 token | ✓ | `tokenManager.setAccessToken(accessToken)` |
| localStorage 鍵名 | ✓ | `fitbuddy_access_token`（tokenManager）、`fitbuddy_refresh_token` |

### Token 保存方式

```javascript
// ✅ 正確：使用 tokenManager（api-client 會讀取）
tokenManager.setAccessToken(accessToken);
tokenManager.setRefreshToken(refreshToken);

// 向後兼容（非主要讀取來源）
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
```

**重點**: 未使用 `localStorage.setItem('token', token)`，而是 `tokenManager.setAccessToken()`，會存到 `fitbuddy_access_token`。api-client 的攔截器會從這裡讀取，行為正確。

---

## 3. Google OAuth Library

| 項目 | 值 |
|------|-----|
| **套件** | `@react-oauth/google` (v0.13.4) |
| **Provider** | `GoogleOAuthProvider` 包在 `main.tsx` 的 App 外層 |
| **Hook** | `useGoogleLogin`，`flow: 'auth-code'` |
| **回調** | `onSuccess: (codeResponse) => { ... }`，取得 `codeResponse.code` |
| **IdToken 處理** | 使用 **authorization code** 流程，非 implicit/id_token；code 送後端由後端向 Google 換 token |
| **發送給後端** | ✓ 正確：只送 `code`，由後端完成 token 交換與驗證 |

---

## 4. 流程總覽

```
前端 (GoogleLoginButton)
  → useGoogleLogin(flow: 'auth-code')
  → onSuccess 取得 code
  → POST /api/auth/google/callback { code, clientId, flow }
  → 後端用 code 向 Google 換 token
  → 後端建立/查找用戶
  → 後端生成 JWT (token + refreshToken)
  → 返回 { token, refreshToken, user, isNewUser, flow }

前端
  → 取得 data.token
  → tokenManager.setAccessToken(data.token)
  → tokenManager.setRefreshToken(data.refreshToken)
  → setUser(data.user)
  → 依 role 導向 /coach-dashboard 或 /client-dashboard
```

---

## 5. 結論

| 檢查項目 | 結果 |
|----------|------|
| Google OAuth 回調端點 | `POST /api/auth/google/callback` |
| 後端返回格式 | `{ token, refreshToken, user, isNewUser, flow }` |
| 前端 token 提取 | ✓ `data.accessToken \|\| data.token` |
| 前端 token 保存 | ✓ `tokenManager.setAccessToken()` → `fitbuddy_access_token` |
| localStorage 鍵名 | ✓ `fitbuddy_access_token`（api-client 預期） |

**Google OAuth 流程本身設計正確。** 若登入後出現 401，多半與「註冊未完成」有關（`/api/auth/me` 因 `registrationComplete: false` 回 401），而非 OAuth 或 token 保存問題。
