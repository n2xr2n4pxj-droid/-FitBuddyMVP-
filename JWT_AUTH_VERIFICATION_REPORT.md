# JWT 認證與授權驗證報告

## 1. server/middleware/auth.ts

- **檔案位置**: `server/middleware/auth.ts`
- **verifyJWT 來源**: 從 `../replitAuth` 引入，非本地定義
- **驗證邏輯**: 在 `server/replitAuth.ts` 中實作

## 2. server/replitAuth.ts（verifyJWT 實際實作）

- **Secret 來源**: `getJWTSecret()` → `config.jwt.secret || 'dev-jwt-secret-change-in-production'`
- **驗證方式**: `jwt.verify(token, JWT_SECRET)`（需 `authHeader.startsWith('Bearer ')`）
- **Authorization 格式**: 預期 `"Bearer {token}"`，取 `substring(7)` 取得 token

## 3. server/routes/auth.ts（Token 生成與 /auth/me）

- **Token 生成**: `generateAccessToken()` 使用 `JWT_SECRET`（來自 `getJWTSecret()`）
- **getJWTSecret 實作**: `config.jwt.secret || 'dev-jwt-secret-key'`（與 replitAuth **預設值不同**）
- **Token 過期**: `ACCESS_TOKEN_EXPIRATION` 預設 `'7d'`，`REFRESH_TOKEN_EXPIRATION` 預設 `'30d'`
- **/auth/me 驗證**: 自行呼叫 `jwt.verify(token, JWT_SECRET)`，與生成時使用同一 secret
- **問題**: 當 `JWT_SECRET` 未設時，replitAuth 用 `'dev-jwt-secret-change-in-production'`，routes/auth 用 `'dev-jwt-secret-key'`，會導致不一致

## 4. 環境變數

- **config 讀取**: `server/config/env.ts` 從 `.env`、`.env.local`、`server/.env.local` 載入
- **JWT_SECRET**: `getEnv('JWT_SECRET', '')`，無預設值
- **server/.env.local**: 有設定 `JWT_SECRET`（長度約 64 字元，為 hex 字串格式）
- **注意**: 若 .env.local 中 JWT_SECRET 重複定義，後者會覆蓋前者

## 5. Authorization Header（前端）

- **格式**: `Authorization: Bearer ${token}`
- **來源**: `client/src/lib/api-client.ts` 請求攔截器
- **程式碼**: `config.headers.Authorization = \`Bearer ${token}\``（`token` 來自 `tokenManager.getAccessToken()`）
- **結論**: 格式正確

## 6. client 端（checkAuth / fetchMe）

- **checkAuth 位置**: `client/src/store/auth.store.ts`（非 `useAuth.ts`）
- **fetchMe**: 使用 `api.auth.me()` → `apiClient.get('/api/auth/me')`
- **api.auth.me**: 透過 apiClient 發送請求，攔截器自動附加 `Authorization: Bearer ${token}`
- **API 路徑**: `/api/auth/me`（非 `/api/v1/auth/me`，專案未定義 v1 auth 路徑）

## 7. localStorage Token 鍵名

| 用途 | 鍵名 |
|------|------|
| api-client / tokenManager | `fitbuddy_access_token` |
| Refresh Token | `fitbuddy_refresh_token` |
| Zustand persist (auth store) | `fitbuddy-auth-store`（存整包 state，含 token） |
| 舊版相容 | `authToken`（logout 時會清除） |

- **結論**: 正確使用的是 `fitbuddy_access_token`，不是 `'token'` 或 `'auth_token'`

---

## 總結

| 項目 | 結果 |
|------|------|
| JWT_SECRET 長度/格式 | 在 .env 中設定時約 64 字元 hex 字串 |
| Token 生成與驗證 Secret | 在 routes/auth 內一致；與 replitAuth 在**未設 JWT_SECRET** 時預設值不同 |
| 前端 Authorization 格式 | `Bearer {token}`，正確 |
| API 路徑 | `/api/auth/me`，不應改為 `/api/v1/auth/me` |

## 建議修復

1. **統一 JWT Secret 預設值**：讓 `replitAuth.ts` 與 `routes/auth.ts` 使用相同的 fallback secret
