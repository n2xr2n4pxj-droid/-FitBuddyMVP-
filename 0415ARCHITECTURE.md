# 全域架構掃描報告（FitBuddyMVP）

本次是基於程式碼與設定檔的靜態掃描（含 `tsc` 檢查）結果；`npm run check` 已通過，代表目前沒有明顯缺漏 import 或型別斷裂。

---

## 1) 專案結構與技術棧

### 頂層結構（核心）
- `client`：前端應用（React + Vite）
- `server`：後端 API（Express + TypeScript）
- `shared`：前後端共享 schema/type
- `drizzle`、`prisma`：雙 ORM/Schema 資產並存（Drizzle 為主，Prisma 仍保留）
- `e2e`、`tests`：整合測試 / E2E

### 技術棧識別
| 層 | 技術 |
|---|---|
| Frontend | React 18、Vite 7、wouter、React Query、Zustand、Axios、Radix UI、Tailwind |
| Backend | Express 4、TypeScript/tsx、Drizzle ORM、PostgreSQL (Neon)、JWT、Passport/Session、Zod |
| Auth | JWT Access + Refresh、Google OAuth、Session/JWT 混合驗證 |
| Testing | Playwright、Vitest（E2E API workflow） |

### `package.json` 關鍵依賴（root）
- 框架/路由：`react`、`react-router-dom`（已裝但實際主路由走 `wouter`）
- 狀態：`zustand`
- 資料請求：`axios`、`@tanstack/react-query`
- 後端：`express`、`jsonwebtoken`、`passport`、`drizzle-orm`
- UI：`@radix-ui/*`、`tailwindcss`
- DB：`@neondatabase/serverless`、`drizzle-kit`、`prisma`
- 測試：`@playwright/test`

---

## 2) 前端架構

### 路由系統（Authenticated / Unauthenticated）

```1:26:client/src/routes/UnauthenticatedRoutes.tsx
<Switch>
  <Route path="/login" component={AuthLoginPage} />
  <Route path="/auth/google/callback" component={GoogleCallback} />
  <Route path="/auth/callback" component={GoogleCallback} />
  <Route path="/register-flow" component={RegisterFlow} />
  <Route path="/verify-email-prompt" component={VerifyEmailPrompt} />
```

- **Unauthenticated URL 路由**：`/`、`/login`、`/register-flow`、Google callback、verify prompt
- **Authenticated 主流程**：非 URL 多頁 router，而是 `App.tsx` 以 tab 狀態切換 `ClientRouter / CoachRouter`
- `ProtectedRoute.tsx` 存在，但目前主入口 `App.tsx` 主要透過 `useAuth` + `registrationComplete` 控制

### Store（Zustand）清單
| Store | 檔案 | 職責 | Key Actions |
|---|---|---|---|
| Auth Store | `client/src/store/auth.store.ts` | 登入狀態、使用者、註冊完成度、OAuth | `login` `register` `loginWithOAuth` `fetchMe` `initializeAuth` `selectRole` `logout` |
| Register Flow Store | `client/src/stores/useRegisterStore.ts` | 多步註冊表單暫存與持久化 | `setCurrentStep` `updateStep` `getFormData` `submit` `resetAll` |

### Services / API 呼叫方式
- **兩套 API 層並存（技術債）**
  - `client/src/lib/api-client.ts`：Axios + interceptor + token refresh
  - `client/src/lib/api.ts`：fetch wrapper + typed API catalog
- `authService` 使用 `apiClient`；邀請相關多用 `fetch` + 手動 headers

### Token 管理機制（前端）
| 項目 | 內容 |
|---|---|
| Access token key | `fitbuddy_access_token` |
| Refresh token key | `fitbuddy_refresh_token` |
| 舊 key 相容 | `authToken` |
| 另一套 legacy key | `fitbuddy_token`（`api.ts` 與 RegisterFlow 仍使用） |
| Header | `Authorization: Bearer <token>` |

### Pages / Components 組織
- `pages` 下同時有新舊路徑（如 `pages/auth/*` 與較舊 `pages/auth-login.tsx` 等），顯示歷史遷移痕跡
- `components` 以功能切分：`coach`、`plans`、`workout`、`nutrition`、`settings`、`progress`、`ui`

### 前端環境變數（`VITE_*`）
| 變數 | 來源用途 |
|---|---|
| `VITE_API_BASE_URL` | API base URL |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 前端 client id |
| `VITE_GOOGLE_CALLBACK_URL` | OAuth callback URL |
| `VITE_APP_NAME` / `VITE_APP_VERSION` | 應用資訊 |
| `VITE_PUSH_VAPID_PUBLIC_KEY` | Web Push 公鑰 |

---

## 3) 後端架構

### Express Router 結構（prefix）
| Prefix | Router 檔案 |
|---|---|
| `/api` | `auth` `workouts` `coaches` `coach-client` `plans` `users` `ai` `notifications` `exercises` `health` |
| `/api/dashboard` | `dashboard` |
| `/api/analytics` | `analytics` |
| `/api/nutrition` | `nutrition` |
| `/api/food` | `food` |
| `/api/v1/invitations`、`/api/invitations` | `invitations`（新舊並存） |
| `/api/v1/users` | `users-v1` |
| `/api/admin/email` | `emailAdminRoutes` |

```44:84:server/routes.ts
export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);
  app.use("/api", healthRoutes);
  app.use("/api", userRoutes);
  app.use("/api/v1/users", usersV1PublicRoutes);
  app.use("/api/auth/login", authLimiter);
  ...
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/nutrition", nutritionRoutes);
```

### Middleware 鏈
- `verifyJWT`：支援 Session 優先，再 Bearer JWT 回退
- `isAuthenticated`：session -> `verifyJWT`
- `authLimiter`：登入/註冊/忘記密碼速率限制
- 全域錯誤處理：`server/index.ts` 統一 `status/message` JSON

### Database Schema（Drizzle 主體）
- 主要表：`users`, `invitations`, `coach_clients`, `workout_routines`, `routine_exercises`, `exercise_sets`, `workout_sessions`, `session_exercises`, `session_sets`, `session_feedbacks`, `meals`, `workouts`, `notifications`, `push_subscriptions`, `body_composition_logs`, `plan_assignments` 等
- 關鍵關聯：
  - `users` 1:N 到多數 domain 表
  - `workout_routines` -> `routine_exercises` -> `exercise_sets`
  - `workout_sessions` -> `session_exercises` -> `session_sets`
  - `coach_clients` 連接 coach/client

> 另有 `prisma/schema.prisma`，與 Drizzle schema 在角色 enum/資料模型上存在不一致，屬於架構分岔風險。

### 後端環境變數（彙整）
| 類別 | 變數 |
|---|---|
| App | `NODE_ENV` `PORT` `APP_URL` `CLIENT_URL` |
| DB | `DATABASE_URL` `DATABASE_PASSWORD` |
| Auth | `JWT_SECRET` `REFRESH_TOKEN_SECRET` `ACCESS_TOKEN_EXPIRATION` `REFRESH_TOKEN_EXPIRATION` `SESSION_SECRET` |
| OAuth | `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` `GOOGLE_CALLBACK_URL` |
| CORS | `CORS_ORIGIN` |
| Email | `RESEND_API_KEY` `EMAIL_FROM` `EMAIL_REPLY_TO` `EMAIL_SUPPORT`（另有 SendGrid 相關） |
| AI/Push | `GEMINI_API_KEY` `GEMINI_MODEL` `PUSH_VAPID_PUBLIC_KEY` `PUSH_VAPID_PRIVATE_KEY` |

### 認證系統（JWT / Refresh / OAuth）
```453:599:server/replitAuth.ts
export const verifyJWT: RequestHandler = async (req: any, res, next) => {
  // 1) session 認證
  // 2) Bearer JWT 驗證 + DB 查 user
  // 3) 失敗回 401
};
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return verifyJWT(req as any, res as any, next);
};
```

- Refresh token：`POST /api/auth/refresh` 會驗證 refresh token 並 rotation 回傳新 access+refresh
- OAuth：`POST /api/auth/google/callback` 做 code exchange、抓 Google user、依 flow(login/register) 決策

---

## 4) 資料流

### 前後端通信
- 主要為 REST JSON API
- 未見實際 WebSocket server 使用（雖有 `ws` 依賴）

### Token 傳遞
- 存於 localStorage（多 key 並存）
- API 透過 `Authorization: Bearer ...`
- 部分請求帶 `credentials: 'include'`（Session/Cookie 路徑兼容）

### 錯誤處理規範
- 後端多數格式為 `{ error }` 或 `{ message }`，未完全統一
- invitation 流程有 `errorCode` / `logId` 擴充，前端有對應顯示與追蹤
- `api.ts` 使用 `{ message, statusCode }` 例外型別；`api-client.ts`則沿 Axios error

---

## 5) 已實作功能模組（含測試）

| 模組 | 狀態 | 測試 |
|---|---|---|
| Auth（註冊/登入/refresh/OAuth/role-select） | 已實作 | `tests/auth/auth-resilience.spec.ts`（Playwright） |
| Coach-Client 邀請流 | 已實作 | 在 `e2e/api-workflow.test.ts` 涵蓋 |
| Workout Routines / Sessions / Feedback | 已實作 | `e2e/api-workflow.test.ts` 涵蓋 |
| Plans 指派與 learner 查詢 | 已實作 | `e2e/api-workflow.test.ts` 涵蓋 |
| Nutrition logs（基礎） | 已實作 | 部分被 workflow 觸及，無單元細測 |
| Notifications / Push | 已實作 API | 暫無明確自動化測試檔 |
| Analytics（body composition / volume） | 已實作 API | 暫無明確自動化測試檔 |

---

## 6) 已知問題 / 技術債

### TODO / FIXME / HACK（實際命中）
- `RegisterFlow` 尚有步驟驗證與錯誤提示 TODO
- `WorkoutHistory`、`FitBuddyPro` 多處「後續補齊」TODO
- `ClientRouter`/`CoachRouter` 有「開發中」頁面占位

### 型別不安全（`as any`）
- 熱點在：
  - `server/routes/auth.ts`, `server/routes/users.ts`, `server/replitAuth.ts`
  - `client/services/invitationService.ts`, `client/store/auth.store.ts`, `client/stores/useRegisterStore.ts`

### 重複與可抽象
- `api.ts` 已收斂為 domain facade：token key、錯誤正規化、retry/refresh 與並發 401 單飛 refresh 邏輯皆集中於 `api-client.ts`（不再分裂）
- 新舊路由與頁面並存（`AuthRoutes`、`AuthRoutesReactRouter`、`UnauthenticatedRoutes` + 舊 `pages/auth-*.tsx`）

---

## 7) 未完成 / 缺失部分

### 統一 API 客戶端層
- 已完成：`client/src/lib/api.ts` 改為以 `request` facade 統一 HTTP 呼叫，token key、`AppApiError` 錯誤模型、retry/refresh 與並發 401 單飛 refresh 全部集中於 `client/src/lib/api-client.ts`。

### UI placeholder / 開發中
- `ClientRouter`：`social` 頁面顯示「開發中」
- `CoachRouter`：`clients` / `schedule` / `analytics` 顯示「開發中」
- `App.tsx`：`onLogFood` 仍是 `console.log("TODO: open food logging modal")`

### Route 定義但功能預留
- `client/src/lib/api.ts` 有多個「API 預留，後端即將新增」註記（尤其 nutrition plans）
- 後端 route 無明顯空 handler；但跨模組規格仍有「新舊版本共存」造成語意重複

### Import 但未實作
- 以 `tsc` 結果看，沒有破損 import
- 但存在「實作完成度不足」而非「檔案缺失」的情況（例如 placeholder tab）

---

## 關鍵程式片段（證據）

```30:39:client/src/lib/api-client.ts
const ACCESS_TOKEN_KEY = 'fitbuddy_access_token';
const REFRESH_TOKEN_KEY = 'fitbuddy_refresh_token';
```

```1:14:client/src/lib/api.ts
import { request } from "@/lib/api-client";

// API facade：所有 token header、retry/refresh、錯誤正規化都由 `api-client.ts` 統一處理
export const api = {
  searchExercises: (search: string, limit = 20) =>
    request.get<Exercise[]>(
      `/api/exercises?search=${encodeURIComponent(search)}&limit=${limit}`,
    ),
};
```

```156:193:client/src/lib/api-client.ts
async function getRefreshedTokenSingleFlight(context?: { url?: string; source?: 'request' | 'response' }): Promise<string> {
  // 單飛 refresh：同時間只有一個 refresh Promise；其他請求排隊等待同一份 refresh 結果
  if (!refreshPromise) {
    refreshPromise = performTokenRefresh().finally(() => {
      refreshPromise = null;
      pendingRefreshWaiters = 0;
    });
    return refreshPromise;
  }
  pendingRefreshWaiters += 1;
  try {
    return await refreshPromise;
  } finally {
    pendingRefreshWaiters = Math.max(0, pendingRefreshWaiters - 1);
  }
}
```

```334:355:client/src/lib/api-client.ts
export function normalizeApiError(error: unknown): AppApiError {
  if (error instanceof Error && error.name === 'AppApiError') return error;
  if (axios.isAxiosError(error)) {
    const payload = extractErrorPayload(error.response?.data);
    return createAppApiError({
      message: payload.message || error.message || 'API request failed',
      statusCode: error.response?.status,
      errorCode: payload.errorCode,
      logId: payload.logId,
      details: payload.details ?? error.response?.data,
    });
  }
  return createAppApiError({ message: 'Unknown API error', details: error });
}
```

```805:858:server/routes/auth.ts
router.post('/auth/refresh', async (req: any, res: any) => {
  ...
  const newAccessToken = generateAccessToken(...)
  const newRefreshToken = generateRefreshToken(String(user.id));
  res.json({ success: true, token: newAccessToken, refreshToken: newRefreshToken, ... });
});
```

```1324:1339:server/routes/auth.ts
router.post('/auth/google/callback', async (req: any, res: any) => {
  const { code, clientId, flow } = req.body;
  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Authorization code is required',
    });
  }
```

```24:28:client/src/components/CoachRouter.tsx
case "clients":
  return <div className="px-4 text-slate-100">學員列表（開發中）</div>;
case "schedule":
  return <div className="px-4 text-slate-100">排表頁面（開發中）</div>;
```

```206:214:client/src/pages/auth/RegisterFlow/RegisterFlow.tsx
// TODO: 實現各步驟的驗證邏輯
...
// TODO: 顯示錯誤提示
```

---

## 建議下一步行動（優先順序）

1. **（已完成）統一 API 客戶端層**：`api.ts` 以 `request` facade 統一 HTTP 呼叫；token key、錯誤正規化、retry/refresh 與並發 401 單飛機制集中於 `api-client.ts`。  
2. **清理認證與路由遺留**：確認唯一入口路由（wouter），淘汰舊 `auth-*` pages 與重複 route config。  
3. **完成註冊流程 TODO**：補齊 `RegisterFlow` 驗證/錯誤顯示，避免流程中斷。  
4. **收斂 DB schema 策略**：決定 Drizzle 或 Prisma 單一真實來源，移除分岔。  
5. **建立錯誤契約標準**：後端統一 `{ errorCode, message, logId }`，前端單一解析層。  
6. **補測試空白區**：notifications、analytics、nutrition plans 的 API/前端互動測試。  
