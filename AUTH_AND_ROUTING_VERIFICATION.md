# 認證與路由驗證報告

## 1. useAuth() Hook 與認證機制

### 1.1 useAuth 定義位置
- **檔案**: `client/src/hooks/useAuth.ts`
- **來源**: 封裝 `useAuthStore()`（Zustand store），不對外直接暴露 store。

### 1.2 useAuth 暴露的 API

| 類別 | 屬性/方法 | 說明 |
|------|-----------|------|
| **狀態** | `user` | 當前用戶物件（含 `id`, `email`, `firstName`, `lastName`, `avatar`, `role`, `createdAt`, `emailVerified`） |
| | `token` | 存取 token（與 store 同步，實際讀取來自 persist） |
| | `refreshToken` | 刷新 token |
| | `isAuthenticated` | 是否已認證（`!!user`） |
| | `isLoading` | 是否正在載入 |
| | `error` | 錯誤訊息 |
| | `needsVerification` | 是否需要郵箱驗證 |
| **角色檢查** | `isClient` | `user?.role === 'client'`（注意：store 使用小寫） |
| | `isCoach` | `user?.role === 'coach' \|\| user?.role === 'both'` |
| | `isAdmin` | `user?.role === 'admin'` |
| **網路** | `isOfflineMode` | 已認證且離線 |
| | `isOnline` | `navigator.onLine` |
| **操作** | `login` | 登入（email + password） |
| | `register` | 註冊 |
| | `selectRole` | 選擇角色（呼叫 `/api/auth/role-select`） |
| | `logout` | 登出 |
| | `fetchMe` | 取得當前用戶（`/api/auth/me`） |
| | `checkAuth` | 啟動時檢查認證（讀 token → fetchMe → 設定 user） |
| **日誌** | `logAction` | 記錄使用者操作 |

### 1.3 底層 Store
- **檔案**: `client/src/store/auth.store.ts`
- **Store 名稱**: `useAuthStore`
- **User 型別（store）**: `role: 'client' | 'coach' | 'admin' | 'both'`（**小寫**）
- **型別定義（types/auth.ts）**: `UserRole = 'USER' | 'COACH' | 'BOTH' | 'ADMIN'`（**大寫**）

---

## 2. Role 與認證資料存儲位置

### 2.1 記憶體狀態（Zustand）
- **Store**: `useAuthStore`（`client/src/store/auth.store.ts`）
- **欄位**: `user`（內含 `role`）、`token`、`refreshToken`、`isAuthenticated`、`isLoading`、`error` 等。

### 2.2 持久化（localStorage）
- **Zustand persist**
  - **Key**: `fitbuddy-auth-store`（Zustand 預設會加前綴，實際 key 可能為 `fitbuddy-auth-store`）
  - **持久化欄位**（`partialize`）:
    - `token`
    - `refreshToken`
    - `user`（含 `role`）
  - 因此 **role 存儲在 localStorage**（經由 Zustand persist），key 為 auth store 的 persist name。

- **Token 管理（api-client）**
  - **Access Token**: `localStorage.getItem('fitbuddy_access_token')`
  - **Refresh Token**: `localStorage.getItem('fitbuddy_refresh_token')`
  - 定義於 `client/src/lib/api-client.ts`（`ACCESS_TOKEN_KEY`, `REFRESH_TOKEN_KEY`）。

### 2.3 總結：Role 存儲
| 位置 | 內容 |
|------|------|
| **Zustand 記憶體** | `useAuthStore.getState().user?.role` |
| **localStorage（Zustand persist）** | `user` 物件（含 `role`）透過 key `fitbuddy-auth-store` 持久化 |
| **未單獨存 role** | 無單獨的 `localStorage.getItem('role')`，role 僅在 `user` 內 |

### 2.4 潛在問題：Role 值格式
- **auth.store / useAuth**: 使用小寫 `'client' | 'coach' | 'admin' | 'both'`。
- **types/auth.ts、後端、ProtectedRoute**: 使用大寫 `'USER' | 'COACH' | 'BOTH' | 'ADMIN'`。
- **App.tsx 保護路由**: `requiredRoles={['COACH', 'BOTH']}` 等為大寫。
- 若後端或 JWT 回傳大寫，而 store 未統一轉換，會導致 `user.role === 'COACH'` 但 `isCoach` 檢查 `user?.role === 'coach'` 為 false，需在設定 `user` 時做 `normalizeRole()` 或統一約定格式。

---

## 3. App.tsx 路由結構驗證

### 3.1 使用的 Router
- **套件**: `wouter`（`Switch`, `Route`）
- **無** `path="/dashboard"` 的 Route。

### 3.2 已認證用戶區塊內的路由（依順序）

| 路徑 | 組件 | 說明 |
|------|------|------|
| `/auth/verify-email/:token` | VerifyEmail | 郵箱驗證 |
| `/verify-email/:token` | VerifyEmail | 同上 |
| `/verify-email-prompt` | VerifyEmailPrompt | 驗證提示 |
| `/resend-verification` | ResendVerification | 重發驗證 |
| `/auth/accept-invitation/:code` | AcceptInvitation | 接受邀請 |
| `/role-selection` | RoleSelection | 角色選擇 |
| `/coach-dashboard` | ProtectedRoute(COACH,BOTH) → CoachDashboard | 教練儀表板 |
| `/send-invitation` | ProtectedRoute(COACH,BOTH) → SendInvitation | 發送邀請 |
| `/client-dashboard` | ProtectedRoute(USER,BOTH) → ClientDashboard | 客戶儀表板 |
| `/unauthorized` | Unauthorized | 未授權頁 |
| `/tdee` | TDEECalculator | TDEE 計算 |
| `/profile` | Profile | 個人資料 |
| `/history` | History | 歷史 |
| `/trends` | Trends | 趨勢 |
| **`/`** | **Dashboard** | **主儀表板（唯一首頁儀表板）** |
| （其餘） | NotFound | 404 |

### 3.3 關鍵發現：`/dashboard` 未定義

- **App.tsx 中沒有** `Route path="/dashboard"`。
- 主 Dashboard 組件綁定在 **`Route path="/"`**，即根路徑 `/`。
- 下列位置目前導向 **`/dashboard`**：
  - `RegisterFlow.tsx`: `setLocation('/dashboard')`（多處）
  - `GoogleLoginButton.tsx`: `window.location.replace('/dashboard')`
  - `LoginPage.tsx`: `setLocation('/dashboard')`
  - `Step7RoleSelection.tsx`: `setLocation('/dashboard')`

在 wouter 下，訪問 `/dashboard` 不會匹配 `path="/"`（`/` 為精確匹配），因此會落到最後的 `<Route component={NotFound} />`，**使用者會被導到 404**。

### 3.4 建議修正

**方案 A（建議）：新增 `/dashboard` 並指向同一 Dashboard**
- 在 App.tsx 已認證區塊中，在 `path="/"` 之前新增：
  - `<Route path="/dashboard" component={Dashboard} />`
- 如此既有「首頁 = `/`」也支援「登入/註冊完成 → `/dashboard`」的寫法，無需改動現有 redirect 程式碼。

**方案 B：統一改為導向 `/`**
- 將所有 `setLocation('/dashboard')` 與 `window.location.replace('/dashboard')` 改為 `setLocation('/')` / `window.location.replace('/')`。
- 需改動多個檔案，且若未來想區分「首頁 landing」與「登入後首頁」，會較不直觀。

---

## 4. 驗證結論

| 項目 | 狀態 | 說明 |
|------|------|------|
| useAuth() 存在且集中 | ✅ | `hooks/useAuth.ts` 封裝 `useAuthStore`，提供狀態與操作 |
| Role 存儲位置 | ✅ | 在 Zustand `user` 中；經 persist 存於 localStorage（key: auth store 的 persist name） |
| Token 存儲 | ✅ | `fitbuddy_access_token`、`fitbuddy_refresh_token` 於 localStorage（api-client） |
| Role 值格式不一致 | ⚠️ | Store/useAuth 為小寫，types/後端/ProtectedRoute 為大寫，需統一或 normalize |
| `/dashboard` 路由 | ❌ | App.tsx 未定義 `/dashboard`，僅有 `/` → Dashboard，會導致 404 |

建議優先處理：
1. **在 App.tsx 新增 `Route path="/dashboard" component={Dashboard}"`**，避免登入/註冊後導向 404。
2. 在 `auth.store` 或 API 回傳處理處統一 **role 格式**（例如一律轉大寫再存進 `user.role`，或約定前端一律使用大寫與 `types/auth.ts` 一致）。
