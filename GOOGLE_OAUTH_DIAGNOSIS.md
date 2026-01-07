# Google OAuth 登錄問題診斷報告

## 已修復的問題

### 1. ✅ Token Exchange 格式錯誤（關鍵問題）
**問題：** Google OAuth token endpoint 要求使用 `application/x-www-form-urlencoded` 格式，但代碼使用了 JSON 格式。

**修復：** 已將 token exchange 請求格式改為 `application/x-www-form-urlencoded`：

```typescript
// 修復前（錯誤）：
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ ... })

// 修復後（正確）：
headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
body: params.toString() // URLSearchParams
```

**位置：** `server/routes/auth.ts` 第 983-996 行

### 2. ✅ 增強錯誤日誌
**修復：** 添加了更詳細的錯誤日誌，包括：
- 配置檢查（clientId, clientSecret, redirectUri 是否存在）
- Token exchange 參數日誌
- 更詳細的錯誤響應處理

## 需要確認的配置

### 3. ⚠️ Redirect URI 配置（需要驗證）

**當前環境變數設置：**
```
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/callback
```

**問題：** `@react-oauth/google` 的 `useGoogleLogin` 在 `flow: 'auth-code'` 模式下：
- 默認使用當前頁面的 **origin** 作為 redirect_uri
- 對於 `http://localhost:5173`，redirect_uri 應該是 `http://localhost:5173`
- **不包含路徑**（如 `/auth/callback`）

**需要檢查：**
1. 在 Google Cloud Console 中，授權重定向 URI 必須包含：
   - `http://localhost:5173`（開發環境）
   - 生產環境的 URL（如 `https://yourdomain.com`）

2. 環境變數 `GOOGLE_CALLBACK_URL` 應該設置為：
   ```
   GOOGLE_CALLBACK_URL=http://localhost:5173
   ```
   而不是 `http://localhost:3000/auth/callback`

**驗證步驟：**
1. 檢查 Google Cloud Console → API & Services → Credentials
2. 確認 OAuth 2.0 Client ID 的「授權的重新導向 URI」中包含：
   - `http://localhost:5173`（開發環境）
   - 生產環境 URL（如果已部署）

### 4. ⚠️ 環境變數配置

**需要的環境變數（server/.env.local）：**
```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5173  # ← 應該是前端 URL
CLIENT_URL=http://localhost:5173  # 可選，作為後備
```

**前端環境變數（client/.env 或 .env.local）：**
```env
VITE_GOOGLE_CLIENT_ID=your-client-id  # 必須與後端的 GOOGLE_CLIENT_ID 相同
```

## 已檢查的其他項目

### 5. ✅ CORS 配置
**狀態：** 已正確配置
- 後端允許 `http://localhost:5173` 的請求
- 設置了 `credentials: true`

**位置：** `server/index.ts` 第 25-28 行

### 6. ✅ 前端代碼傳送 Code
**狀態：** 正確
- `GoogleLoginButton` 組件正確使用 `useGoogleLogin`
- 正確將 `code` 傳送給後端 `/api/auth/google/callback`

**位置：** `client/src/components/GoogleLoginButton.tsx` 第 27-37 行

## 建議的修復步驟

1. **更新環境變數：**
   ```bash
   # 編輯 server/.env.local
   GOOGLE_CALLBACK_URL=http://localhost:5173  # 改為前端 URL
   ```

2. **更新 Google Cloud Console：**
   - 登入 Google Cloud Console
   - 前往 API & Services → Credentials
   - 編輯您的 OAuth 2.0 Client ID
   - 在「授權的重新導向 URI」中添加：`http://localhost:5173`
   - 保存更改

3. **測試：**
   - 重啟後端服務器
   - 清除瀏覽器緩存
   - 嘗試 Google 登錄
   - 檢查服務器日誌以確認配置正確

## 調試建議

如果問題仍然存在，檢查以下日誌：

1. **後端日誌：**
   - `[POST /auth/google/callback] Config:` - 檢查配置是否正確加載
   - `[POST /auth/google/callback] Token exchange params:` - 檢查發送的參數
   - `[POST /auth/google/callback] ❌ Token exchange failed:` - 查看 Google 返回的錯誤

2. **前端控制台：**
   - `[GoogleLoginButton] Authorization code received` - 確認收到 code
   - `[GoogleLoginButton] Error:` - 查看錯誤信息

3. **Google Cloud Console：**
   - 檢查 OAuth 同意屏幕是否已發布（或添加測試用戶）
   - 確認 Client ID 和 Secret 正確
   - 確認 Redirect URI 完全匹配（包括協議、域名、端口）

