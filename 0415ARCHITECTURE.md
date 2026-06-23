# 全域架構掃描報告（FitBuddyMVP）

本次是基於程式碼與設定檔的靜態掃描（含 `tsc` 檢查）結果；`npm run check` 已通過，代表目前沒有明顯缺漏 import 或型別斷裂。

---

## 1) 專案結構與技術棧

### 頂層結構（核心）
- `client`：前端應用（React + Vite）
- `server`：後端 API（Express + TypeScript）
- `shared`：前後端共享 schema/type
- `drizzle`：單一 ORM/Schema 真實來源（Prisma 已移除）
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
- DB：`@neondatabase/serverless`、`drizzle-kit`
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
| Access token key | `fitbuddy_access_token`（localStorage；P1 可改 memory-first） |
| Refresh token | **HttpOnly cookie** `fitbuddy_refresh_token`（P0-2；JS 不可讀） |
| 舊 key 相容 | `authToken`、`fitbuddy_token`、`refreshToken`（逐步清除） |
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

> Prisma schema 與 Prisma 依賴已移除；目前以 Drizzle schema 作為唯一真實來源。

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

### CI — Security Gate Slow E2E（⬜ 技術債，W4 前處理）

- **現況**：`.github/workflows/security-gate.yml` 已拆 **Fast**（`push`/`PR`）與 **Slow**（`workflow_dispatch` / schedule / PR label `run-security-e2e`）。
  - **Fast gate** ✅：`npm run check`、`validate:7.2`、`validate:7.4:static`（無 DB 依賴）。
  - **Slow E2E** ❌（CI）：`security-e2e` job 啟動 `node dist/index.js` 時因 **未注入 `DATABASE_URL`**，`server/db.ts` 於 import 階段拋錯，**Wait for API server** 60s 逾時（非測試 regression）。
- **本機**：`server/.env.local` + Neon dev DB；`npm run test:security:e2e`（54 tests）可全綠。
- **根因**：CI runner 無 Postgres secrets；`.env` / `server/.env.local` 不進 repo（正確）。
- **影響**：手動 `gh workflow run "Security Gate"` 或 nightly Slow job 目前**不可作 merge 門檻**；`push` 時 Fast gate 仍有效。
- **修復 DoD**（預估 0.5～1 天，排 **W4 上架收斂前**）：
  1. 建立 **Neon dev/staging branch**（勿用 production）。
  2. GitHub Secrets：`DATABASE_URL`、`JWT_SECRET`、`REFRESH_TOKEN_SECRET`（必要時 `CLIENT_URL`）。
  3. `security-e2e` job `env` 注入上述 secrets；`Start API server` 步驟一併傳遞。
  4. 驗收：`gh workflow run "Security Gate" --ref main` → Slow E2E 全綠。
- **暫不處理理由**：W3 效能主線優先；Slow E2E 本機可回歸，Fast static gate 已擋主要變更。

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
2. **（已完成）清理認證與路由遺留**：確認唯一入口路由（wouter），淘汰舊 `auth-*` pages 與重複 route config。  
3. **完成註冊流程 TODO**：補齊 `RegisterFlow` 驗證/錯誤顯示，避免流程中斷。  
4. **（已完成）收斂 DB schema 策略**：已定版 Drizzle 為單一真實來源，Prisma schema/依賴已移除。  
5. **（已完成）建立錯誤契約標準**：後端統一 `{ errorCode, message, logId }`，前端單一解析層。  
6. **（已完成）補測試空白區**：notifications、analytics、nutrition plans 的 API/前端互動測試。  
   - API e2e：`e2e/phase6b/notifications.test.ts`、`e2e/phase6b/analytics.test.ts`、`e2e/phase6c/plans.test.ts`。  
   - 前端互動（Playwright）：`tests/phase6c/notifications.ui.spec.ts`、`tests/phase6c/analytics.ui.spec.ts`、`tests/phase6c/nutrition-plans.ui.spec.ts`。  
   - 最新驗證（2026-05-30）：`phase6b` 33/33、`phase6c` 73/73、`tests/phase6c` 3/3 全通過。  

---

## Phase 7: System Hardening（系統硬化）藍圖

> 目標：在功能可用與測試覆蓋達標後，系統化降低「上線風險」、「擴展成本」與「審核失敗風險」（尤其 iOS App Store）。

### 7.1 錯誤合約標準化（Error Contract Robustness）（已完成）

- **核心目標**：消除所有「不明確的失敗」。
- **現況**：雖已完成錯誤契約收斂，但仍需持續防止新路由回退成模糊 500；前端對錯誤語義依賴高。
- **硬化動作**：
  - 強制所有 API 失敗路徑使用明確語義狀態碼（`400/401/403/404/409/422/429/5xx`）。
  - 失敗回應統一格式（至少含 `errorCode`、`message`、`logId`），禁止散落字串錯誤。
  - 增加契約檢查（lint/測試 gate），避免 PR 引入非標準錯誤格式。
  - 補齊前端錯誤映射（以 `errorCode` 驅動 UI 文案，而非僅以 HTTP code 判斷）。

### 7.2 API 路由統一與版本治理（API Unification & Versioning）

- **核心目標**：降低技術債，確保可演進性。
- **現況**：存在 `/api/` 與部分 `/api/v1/` 並存情況，長期會增加維護與遷移成本。
- **硬化動作**：
  - 制定單一版本策略（見下方 §7.2 API 版本策略）。
  - 建立 deprecation 規範：舊路由公告期、相容期、移除期。
  - 對外（Mobile/Web）維持穩定契約，重大變更採版本切換而非破壞性覆寫。
  - 產出路由清單與責任邊界文件，避免重複與陰影端點。

#### §7.2 API 版本策略

**原則**

- **穩定面**（無版本前綴）：`/api/auth/*`、`/api/health`
  - auth 主幹（login / refresh / me / logout）維持 `/api/auth/`，不搬 v1
  - 原因：iOS WebView cookie 路徑、現有 e2e、`JWT_AUTH_VERIFICATION_REPORT` 全綁此路徑
- **演進面**（`/api/v1/<domain>`）：新模組或對外契約變更才走 v1

**Deprecation 三階段**

1. **公告**：舊路徑加 `Deprecation` / `Sunset` / `Link` header，行為不變（既有樣板：`GET /api/auth/user` → `/api/auth/me`）
2. **相容期**（2 週）：雙掛載，新 client 只寫 v1，舊 e2e 標 `@legacy`
3. **移除**：Sunset 日期後刪舊掛載，`validate:7.2` grep gate 轉硬失敗

**現況快照（Phase 7.2 開工時）**

| 路徑 | 狀態 | 目標 |
|------|------|------|
| `/api/auth/login` `/refresh` `/me` `/logout` | 穩定，不版本化 | 維持 |
| `GET /api/auth/verify-email/:token` | legacy（HTML redirect）；**已加 Deprecation header**（Sunset 2026-09-01） | 相容期後移除 |
| `GET /api/v1/auth/verify-email/:token` | v1 JSON 契約 | 維持 |
| `POST /api/v1/auth/resend-verification` | 僅 v1，無 legacy | 維持 |
| `GET /api/v1/auth/check-email-verified` | 僅 v1；前端筆誤已修（PR-1） | 維持 |
| `/api/invitations/*` | legacy，雙掛載；**已加 Deprecation header**（Sunset 2026-09-01） | 相容期後移除 |
| `/api/v1/invitations/*` | 目標路徑，前端已乾淨 | 維持 |
| `/api/workouts/*` `/api/plans/*` | 穩定，7.3 前不動 | 留 W3 |

**刻意不做（避免 W2 膨脹）**

- 不把 login / refresh / me 搬到 `/api/v1/auth`
- 不在 Sunset 前移除 `/api/invitations`（先 header + 文件）
- 不順手大改 workouts / plans 路徑

**W2 封頂標準**

| 項目 | 標準 |
|------|------|
| 文件 | 版本策略 + 路由表 + deprecation 時程 |
| 程式 | `deprecationMiddleware` + invitations legacy 標記（**PR-2 已完成**） |
| 守門 | `npm run validate:7.2` 進 CI |
| 回歸 | `validate:7.4` 仍全綠 |
| 債務 | `check-email-verified` 命名不一致已修（PR-1） |

### 7.3 資料庫效能優化（Database Performance & Scalability）

- **核心目標**：隨使用量成長仍可維持低延遲與穩定吞吐。
- **現況**：🟡 進行中 — `scripts/w3-explain-baseline.sh`（`npm run w3:baseline`）已建立 14 條 proxy 查詢基線。
- **W3 進度（2026-06-23）**：
  - ✅ **PR-1**：`GET /api/analytics/workout-volume` SQL 改寫（去 correlated subquery）。
  - ✅ **PR-1b**：partial index `workout_sessions_user_completed_at_idx`（`user_id`, `completed_at DESC` WHERE `completed_at IS NOT NULL`）。
  - ✅ **PR-2**：list index `workout_sessions_user_list_idx`（`user_id`, `completed_at DESC NULLS LAST`, `started_at DESC`）。
  - ✅ **PR-3**：composite index `coach_clients_coach_client_status_idx`（`coach_id`, `client_id`, `status`）。
  - ⬜ **PR-4+**：`plan_assignments`（#4b、#5）、`workout_routines` upcoming（#6）等其餘 P0。
- **備註**：dev 資料量小時 `EXPLAIN` 可能仍選 Seq Scan；索引價值在資料成長後與 plan 正確性，不以 ms 差異為唯一驗收。
- **硬化動作**：
  - 對高頻查詢模組（`analytics`、`workouts`、`plans`）執行 `EXPLAIN ANALYZE` 盤點。
  - 建立索引策略（查詢條件欄位、排序欄位、複合索引）與 migration 管理。
  - 檢查/避免 N+1 查詢與不必要 round-trip。
  - 建立基準測試（P95/P99、QPS）並納入回歸檢查。

### 7.4 安全性加固（Security Hardening）

- **核心目標**：確保 ReBAC/RBAC 與認證邊界可持續承受惡意流量與誤用。
- **現況**：現有測試可驗證主要流程，但仍需進一步防禦深度。
- **硬化動作**：
  - 盤點並強化 Rate Limiting（登入、邀請、敏感寫入、AI 端點）。
  - 強化 JWT/Refresh Token 驗證流程（簽發、輪替、失效、時鐘偏移容忍）。
  - 檢查敏感資料傳輸與儲存安全（最小揭露、遮罩、審計 log）。
  - 建立安全事件監控與告警（異常登入、暴力嘗試、權限邊界觸發）。

## 目標與完成定義

- 目標：先把「可被濫用、可被撞庫、可越權、可洩漏敏感資訊」這四類風險壓下來。
- 完成定義（DoD）：
  - 關鍵端點有 rate limit，且能被測到 `429`。
  - 關鍵寫入端點都有授權邊界測試（`401/403`）。
  - token 驗證有基本硬化（過期/偽造/錯誤簽章不可通過）。
  - log 不外洩 `password/token/authorization`。
  - 有一個總控腳本：`scripts/validate-7.4.sh` 可一鍵回歸。
- 狀態圖例：`✅ 已完成` / `🟡 進行中` / `⬜ 待開始`

---

## 第 1 週（P0：一定要上）

### ✅ 1) 關鍵端點 Rate Limiting（已完成）
- **實作**
  - 對 `login/register/forgot-password`（你已部分有）做統一策略。
  - 補上 `invitations`、`ai`、敏感寫入（如 `plans/assign`）限制。
- **驗收測試**
  - 同一 IP 短時間連打，應出現 `429` + `Retry-After`。
  - 不同端點命中各自限制，不互相污染。
- **回歸腳本**
  - `scripts/phase7.4/check-rate-limit.sh`
  - 聚合到 `scripts/validate-7.4.sh`

### ✅ 2) JWT / Token 最小硬化（已完成）
- **實作**
  - 拒絕過期 token、錯誤簽章 token、格式錯誤 token。
  - 驗證 `issuer/audience`（若你現況有設定）。
- **驗收測試**
  - 三種壞 token 都回 `401`，且錯誤格式符合 7.1 contract。
- **回歸腳本**
  - E2E：`e2e/phase7.4/auth-token-hardening.test.ts`
  - 指令：`npx vitest run e2e/phase7.4/auth-token-hardening.test.ts`

### ✅ 2b) P0-2：HttpOnly Refresh + Token Revocation（已完成）
- **實作**
  - Refresh token 改 **HttpOnly + Secure + SameSite** cookie（`fitbuddy_refresh_token`），不再由 JS 讀寫。
  - `users.token_version`：logout / 改密碼 / 重設密碼時 `+1`；JWT payload `tv` 與 DB 不符即 `401`。
  - 前端 `api-client`：`withCredentials: true`；refresh 改 cookie 驅動；logout 呼叫後端清 cookie。
  - 新增 `POST /api/auth/change-password`、`POST /api/auth/reset-password`（重設成功亦 bump）。
  - Migration：`scripts/migrations/add_token_version.sql`（或 `npm run db:push`）。
- **驗收測試**
  - 登入後 cookie 有 `HttpOnly`；`localStorage` 無 `fitbuddy_refresh_token`。
  - logout 後舊 access / refresh（含 body fallback）立即 `401`；重登入後舊 token 仍拒絕。
  - 多裝置：任一裝置 logout 後，同 user 其他裝置 token 失效。
- **回歸腳本**
  - E2E：`e2e/phase7.4/auth-refresh-cookie.test.ts`、`e2e/phase7.4/auth-revocation.test.ts`
  - 聚合：`npm run test:security:e2e`（54 tests）/ `npm run validate:7.4`

### ✅ 3) 授權邊界（ReBAC/RBAC）防線（已完成）
- **實作**
  - 針對 `coach-client`、`plans`、`invitations` 建立未授權/跨帳號防護檢查。
- **驗收測試**
  - 非本人/非教練操作應 `403`。
  - 已授權關係可正常 `200/201`。
- **回歸腳本**
  - E2E：`e2e/phase7.4/authorization-boundary.test.ts`、`e2e/phase7.4/authorization-plans.test.ts`、`e2e/phase7.4/authorization-coach-client.test.ts`、`e2e/phase7.4/authorization-workouts-sessions.test.ts`、`e2e/phase7.4/authorization-workouts-learner-access.test.ts`、`e2e/phase7.4/authorization-workouts-learner-detail.test.ts`、`e2e/phase7.4/authorization-analytics.test.ts`
  - 指令：`npm run test:security:e2e`（全量） / `npm run validate:7.4`（總控）

### ✅ 4) 敏感資訊遮罩與錯誤最小揭露（已完成）
- **實作**
  - 統一 logger redact：`password`, `token`, `authorization`, `cookie`, `refreshToken`。
  - 5xx 不回內部堆疊/SQL/secret。
- **驗收測試**
  - 觸發錯誤後，response 不含敏感字串；log 也不含明文。
- **回歸腳本**
  - `scripts/phase7.4/check-redaction.sh`（跑測試後掃 log）
  - 可搭配 `rg` 規則檢查敏感關鍵字。

---

## 第 2 週（P1：建議補齊）

### ✅ 5) 安全標頭與 CORS 收斂（已完成）
- **實作**
  - 補 `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` 等最小組。
  - CORS 白名單化（prod 環境不允許 `*`）。
- **驗收測試**
  - 關鍵 API 回應有標頭；非法來源被擋。
- **回歸腳本**
  - `scripts/phase7.4/check-security-headers.sh`

### ✅ 6) 請求體驗證與輸入邊界（已完成）
- **實作**
  - 高風險寫入端點補齊 schema 驗證與長度限制（避免超大 payload / injection）。
- **驗收測試**
  - 非法 payload 回 `400/422`，合法 payload 正常。
- **回歸腳本**
  - E2E：`e2e/phase7.4/input-validation.test.ts`

### ✅ 7) 安全事件最小監控（已完成）
- **實作**
  - 對 `401/403/429/5xx` 產生基本統計或結構化日誌（含 `logId`）。
- **驗收測試**
  - 人工觸發事件可在 log 看到對應欄位（不含敏感值）。
- **回歸腳本**
  - `scripts/phase7.4/check-security-events.sh`

### ✅ 8) 總控守門（CI 可跑）（已完成）
- **實作**
  - 建立 `scripts/validate-7.4.sh`，串接所有檢查。
- **驗收測試**
  - 本機與 CI 均可一鍵執行，失敗時有明確 FAIL 訊息。
- **回歸腳本**
  - `scripts/validate-7.4.sh`（唯一入口）

### 🟡 8b) Security Gate Slow E2E — CI secrets（技術債，W4 前）

- **Workflow**：`.github/workflows/security-gate.yml`
  | Job | 觸發 | 狀態 |
  |-----|------|------|
  | Security Gate (Fast) | `push` / `pull_request` | ✅ 可跑（static only：`validate:7.4:static`） |
  | Security E2E (Slow) | `workflow_dispatch` / cron / PR label | ❌ CI 缺 DB secrets |
- **失敗症狀**：Slow job 在 **Wait for API server** 失敗；log 為 `DATABASE_URL must be set`（`server/db.ts`）。
- **與 §6 CI 技術債同一項**；修復清單見上文 **CI — Security Gate Slow E2E**。
- **決策**：W3 期間不阻擋主線；**W4 上架收斂前**補齊 secrets 並讓 Slow E2E 成為可選 nightly 門檻。

---

## 建議新增指令（`package.json`）

- `test:security:e2e`: `vitest run e2e/phase7.4 --reporter=verbose`
- `validate:7.4`: `bash scripts/validate-7.4.sh`
- `test:security:all`: `npm run test:security:e2e && npm run validate:7.4`

---

## 執行順序（最短路徑）

- Day 1-2：Rate limit + 驗證腳本  
- Day 3-4：JWT/token + 授權邊界測試  
- Day 5：redaction + validate-7.4 初版  
- Day 6-7：security headers + CORS + input validation  
- Day 8-10：監控事件 + CI 穩定 + 文件收尾

## 當前落地優先順序（更新）

1. **件 8 — CI 整合（完成）**  
   - `package.json` 加：`validate:7.4`、`test:security:e2e`、`test:security:all`  
   - 讓 CI 至少先跑 `npm run check && npm run validate:7.4`
   - 未來 CI 設置可參考以下 GitHub Actions 片段（啟 API → 健康檢查 → 跑 security e2e → 收尾）：

```yaml
- name: Start API server
  run: |
    NODE_ENV=test PORT=3000 node dist/index.js &
    echo "SERVER_PID=$!" >> $GITHUB_ENV

- name: Wait for health
  run: |
    for i in {1..30}; do
      curl -fsS http://127.0.0.1:3000/health && exit 0
      sleep 1
    done
    echo "Server not ready" && exit 1

- name: Run security e2e
  run: npm run test:security:e2e

- name: Stop API server
  if: always()
  run: kill $SERVER_PID || true
```

2. **件 5a — Helmet 安全標頭（完成）**  
   - 補 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`  
   - 可再加 `S6c`/`S5a` 檢查到 `validate-7.4.sh`

3. **件 7 — 安全事件結構化日誌（完成）**  
   - 先定最小 schema（`eventType/status/errorCode/logId/path`）再落地  
   - 這件最容易牽動既有 logger，放最後較穩

4. **P1 completed / P2 in progress（更新）**  
   - ✅ 收斂剩餘 commit（完成）  
   - ✅ 補 `e2e/phase7.4/*`（token + rate-limit，完成）  
   - ✅ 把 S4 接進 `validate-7.4.sh`（完成）  
  - ✅ 授權邊界 e2e 全量補齊（`invitations/plans/coach-client/workouts/analytics`，含 `Double-ID BOLA` detail endpoint）  
   - 🟡 Error Contract 斷言分階段收斂：目前決策為「先不全面改嚴格斷言」，401 維持務實 `toBeDefined`；待 7.1 全面一致後再改為嚴格 `errorCode` 斷言  
   - 🟡 測試資料唯一性策略：目前 `seedActor` 採 `Date.now()+Math.random()`（MVP 可接受）；後續若 CI 併發提高，升級為 `crypto.randomUUID()` / `uuidv4()` 命名以降低碰撞風險  
   - 🟡 **CI Slow E2E 缺 `DATABASE_URL` secrets**（見 §6、§8b）；W4 前補，暫以本機 `test:security:e2e` + Fast gate 代替  
   - 🟡 更新 `0415ARCHITECTURE.md`（目前段落已更新，持續滾動維護）

一句話結論：**W3（7.3 效能與索引）進行中（PR-1～PR-3 已落地）；CI Slow E2E secrets 列 W4 前技術債。**

## iOS 上線 4 週倒排甘特（記錄更新：2026-06-19）

- **W1（安全防線）**：件 3、件 5、件 7、件 8 + **P0-2（HttpOnly refresh + tokenVersion revocation）** 已完成（`validate:7.4` 與 `test:security:e2e` 全綠，54 tests）。
- **W2（7.2 路由與版本治理）**：**已完成** — PR-1～PR-3 已落地（策略、`validate:7.2`、`deprecationMiddleware`、invitations + verify-email legacy header）；7.1 錯誤契約斷言收斂仍維持寬鬆，後續獨立推進。
- **W3（7.3 效能與索引）**：🟡 **進行中** — PR-1～PR-3 已落地；下一 **PR-4** 鎖定 `plan_assignments`（#4b、#5）。
- **W4（上架收斂）**：回歸、監控觀測、上架與營運收尾；**含 CI Slow E2E secrets 補齊**（見 §6、§8b）。

### 7.5 與 iOS App 上架關聯（為什麼 Phase 7 必做）

- **Stability（穩定性）**：若 API 回傳不可預測 500，App 端容易出現白屏/流程中斷，影響審核結果。
- **Predictability（可預測性）**：App 需對常見失敗場景提供可理解回饋（重試、引導、降級），不能依賴崩潰式處理。
- **結論**：Phase 7 是從「可用產品」升級到「可上架、可營運、可擴展產品」的必要工程，不是可選優化。

### 7.6 建議執行順序（落地版）

1. **P0（先做）**：7.1 錯誤合約守門 + 7.4 安全最小防線。  
2. **P1（次做）**：7.2 版本治理與路由統一。  
3. **P1/P2（持續）**：7.3 效能基線、索引優化、壓測回歸。  

---

## Error Contract Audit（2026-04-19）

> 目的：第 5 項動碼前盤點；下列數字來自 repo 內 **grep**，為**現狀上界／需人工再判讀**（例如同一行未寫 `success:` 的 `res.json({...})` 可能仍是成功回應）。

### Step 1 — 後端 `server/routes`（非標準 `.json({` 掃描）

**掃描條件**（可重現）：

```bash
grep -rn "\.json({" server/routes --include="*.ts" | grep -v "success:" | wc -l
grep -rn "\.json({" server/routes --include="*.ts" | grep -v "success:" \
  | sed 's/.*\/\([^/]*\.ts\):.*/\1/' | sort | uniq -c | sort -rn
```

| 檔案 | 命中行數（同上條件） |
|------|---------------------|
| `workouts.ts` | 94 |
| `auth.ts` | 76 |
| `invitations.ts` | 54 |
| `plans.ts` | 46 |
| `coaches.ts` | 29 |
| `analytics.ts` | 24 |
| `notifications.ts` | 23 |
| `emailAdminRoutes.ts` | 23 |
| `coach-client.ts` | 22 |
| `nutrition.ts` | 14 |
| `users.ts` | 8 |
| `users-v1.ts` | 4 |
| `dashboard.ts` | 4 |
| `ai.ts` | 4 |
| `food.ts` | 2 |
| `health.ts` | 1 |
| `exercises.ts` | 1 |
| **合計** | **429** |

**同一掃描範圍內，錯誤相關 key 出現次數**（僅計入該行同時含 `error:` / `message:` / `errorCode:` 者，再擷取 key）：

```bash
grep -rn "\.json({" server/routes --include="*.ts" \
  | grep -E "error:|message:|errorCode:" \
  | grep -oE "(error|message|errorCode|logId|code):" \
  | sort | uniq -c | sort -rn
```

| key（字尾 `:`） | 次數 |
|------------------|------|
| `error:` | 322 |
| `message:` | 15 |
| `errorCode:` / `logId:` / `code:` | 0（此管道未單獨計到；見下） |

**`errorCode` / `logId` 字樣**在 `server/routes` 內目前主要出現在：`invitations.ts`、`emailAdminRoutes.ts`、`analytics.ts`、`auth.ts`（其餘路由多為 `{ error: '...' }` 字串形）。

### Step 2 — 前端現狀

**單一解析層（已存在）**：`client/src/lib/api-error.ts` 的 `extractErrorPayload` 會從 body 讀取 `message` 或 **`error`（字串）**、`errorCode` 或 **`code`**、`logId`；`client/src/lib/api-client.ts` 的 `normalizeApiError` 對 axios 錯誤以 `extractErrorPayload(error.response?.data)` 正規化為 `AppApiError`。

**仍可能繞過上述管線的寫法**（粗掃，排除檔名含 `extractErrorPayload` / `normalizeApiError` / `api-error` 的行）：

```bash
grep -rn "\.message\|response\.data\.error\|err\.response" \
  client/src --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules\|extractErrorPayload\|normalizeApiError\|api-error" \
  | wc -l
```

- **約 124 行**命中；其中混有 **表單 `errors.*.message`、邀請函 UI `invitation.message`** 等非 HTTP API 情境，實際待收斂的 `catch`／toast 需逐檔人工過濾。  
- **前 30 筆範例**（代表模式）：`useRegisterStore.ts`（`error?.response?.data?.message`）、`GoogleLoginButton.tsx`（讀 `errorData.message` / `errorData.error`）、`CoachInvitationModal` / `ClientList` / `WorkoutPlanEditor`（`err instanceof Error ? err.message`）、`NotificationSettings.tsx`、`InvitationCard.tsx`、`LearnerDashboard.tsx` 等。

### Step 3 — `shared/` 與結論

- `shared/` 目前僅有 `schema.ts`，**尚無**共用錯誤 DTO／`errorCode` 列舉；契約型別可後續新增（例如 `shared/errors.ts` 或與現有 `schema` 分離）。  
- **結論**：後端改動面以 **`workouts` / `auth` / `invitations` / `plans`** 最大；前端已有 **`normalizeApiError` + `extractErrorPayload`**，第 5 項實作宜 **先收斂後端輸出**，再 **刪減各元件對 `error.message` 的假設**，並保留一輪 **人工排除非 API 的 `.message` 命中**。

---

## Error Contract Completion Update（2026-05-04）

- **第 5 項狀態**：已完成。  
- **後端驗收**：`server` 目錄已清零 legacy `res.status(...).json({ error: ... })`（掃描結果為 0）。  
- **前端驗收**：主流程已收斂到 `normalizeApiError` / `AppApiError` 單一解析層。  
- **保留命中（可接受）**：僅剩 `client/src/lib/api-client.ts`（核心正規化實作）、`client/src/lib/authUtils.ts`（401 防禦性 fallback）、`client/src/components/settings/NotificationSettings.tsx`（既有 helper，刻意保留）。  
- **備註**：`NotificationSettings` 若後續需要，也可在 Phase 6 再統一切到 `normalizeApiError`，目前不影響第 5 項完成判定。

---

## Session Audit（2026-04-16）

### 範圍
- `server/replitAuth.ts`
- `server/routes.ts`
- `server/routes/auth.ts`

### 結論摘要
1. **目前是 JWT 主流程 + Session fallback 的混合模式**  
   - `/auth/login`、`/auth/me`、`/auth/refresh` 走 JWT 路徑。  
   - `verifyJWT` 仍保留 session-first fallback（先 `req.isAuthenticated()`，再驗 Bearer token）。  
2. **Session 行為仍影響 production 穩定性**  
   - 若 session 路徑仍有流量，deploy/restart 後 session persistence 會直接影響登入體驗。  
3. **identity source 有分岔風險**  
   - `/auth/me`（JWT）與 `/api/auth/user`（session）可能回傳不同 freshness 的 user 狀態。  
4. **已完成第一階段止血**  
   - 已改用 `connect-pg-simple` 並重用既有 Postgres `pool`。  
   - 啟動 log 已確認出現 `[session] sessions table ready`，且無 MemoryStore warning。  

### 主要診斷證據
- `server/replitAuth.ts`：`app.use(getSession())` + `app.use(passport.session())`  
- `server/replitAuth.ts`：`verifyJWT` 先判斷 `req.isAuthenticated()`，session 通過即放行  
- `server/routes/auth.ts`：`/auth/logout` 目前為 JWT 無狀態語意，尚未主動清理 session  
- `server/routes.ts`：`/api/auth/user` 使用 `req.isAuthenticated()` 判斷身份  

### 已完成修正（Phase 1）
- `fix: replace MemoryStore with connect-pg-simple (reuse existing pool)`  
  - 在 `getSession()` 加入 `store: new PgStore({ pool, tableName: "sessions", createTableIfMissing: true, ttl })`
  - 保留既有 cookie 安全設定：`httpOnly` / `secure` / `sameSite: "lax"` / `maxAge`
  - `npm run check` 通過、後端可正常啟動

### 後續行動（Phase 2：架構收斂）
1. **`verifyJWT` 收斂為 JWT-first**  
   - 保留 session fallback 於短期過渡，但降級為次要路徑並加註 deprecation。  
2. **淘汰 `/api/auth/user` session identity path**  
   - 前端逐步統一走 `/auth/me`。  
3. **補齊 logout 一致性**  
   - 在仍保留 session 期間，`/auth/logout` 加入 `req.session.destroy()` / `req.logout()` 清理。  
4. **完成後再評估是否移除 session fallback**  
   - 僅保留 OAuth 必要暫存用途（若流程實際需要）。  

### Task 5 開始條件 Checklist（移除 session fallback 前）

> Task 5 目標：`refactor(auth): remove session fallback from verifyJWT`
>  
> 原則：先以真實流量證明 fallback 幾乎不再被使用，再移除兼容分支。

- [ ] **Task 2~4 已完成且已部署到目標環境**
  - `/api/auth/user` 已標示 deprecated，前端主路徑已統一到 `/auth/me`
  - `/auth/logout` 已同時清理 JWT + session
  - `verifyJWT` 已有 `auth_verified` / `auth_session_fallback` 結構化 log
- [ ] **已完成至少 3~7 天觀測窗口（依流量選擇）**
  - 每日可取得 fallback 次數與總驗證次數
  - 觀測期間有涵蓋平日尖峰與低峰流量
- [ ] **fallback 使用量達標**
  - `auth_session_fallback` 佔比 < 1%（建議接近 0%）
  - 最近 24~48 小時無集中 fallback 尖峰
- [ ] **關鍵流程回歸驗證完成**
  - 登入後主流程（Dashboard / 受保護 API）僅使用 Bearer JWT 可正常運作
  - 註冊後補流程（`/auth/me` 相關狀態）無 session 依賴
  - 教練端與學員端核心頁面無 fallback 命中
- [ ] **OAuth 行為確認**
  - Google OAuth callback 若仍需 session 暫存，已有獨立註記與保留邊界
  - 移除 `verifyJWT` fallback 不會影響 callback 完成後的 JWT 流程
- [ ] **風險控制與回滾方案就緒**
  - 可在 5~10 分鐘內回滾到上一版（保留 fallback）
  - 上線後已安排 24~48 小時 401 錯誤率監控
- [ ] **技術驗收條件（Task 5）**
  - 受保護 API 未帶 Bearer token 一律回 401
  - `/api/auth/user` 不再作為身份來源（移除或固定返回 deprecated 錯誤）
  - `npm run check` 通過，且無新增 lint/type error
