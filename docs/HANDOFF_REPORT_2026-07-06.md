# FitBuddyMVP — 資深架構師交接報告

**專案：** FitBuddyMVP（n2xr2n4pxj-droid/-FitBuddyMVP-）  
**分支：** main（已與 origin/main 同步）  
**報告日期：** 2026-07-06  
**文件主來源：** 0415ARCHITECTURE.md、開發對話實作紀錄  
**甘特進度：** 16/20 工作日完成（D-5 完成；D-4～D-1 待開始）

---

## 1. 產品大網與 App 功能全景

### 1.1 產品定位

**FitBuddy** 是教練與學員共用的 **健身訓練 + 營養追蹤** 平台（MVP）。核心價值：

- **學員（Learner / Client）**：記錄訓練與飲食、追蹤進度、執行教練指派的課表
- **教練（Coach / Trainer）**：管理學員關係、建立訓練課表、查看學員訓練紀錄與數據
- **平台能力**：帳號與角色、邀請綁定、通知、分析報表、AI 輔助（課表/摘要）

產品形態為 **響應式 Web App**（mobile-first UI），計畫以 **Capacitor iOS 薄殼** 包裝上架 App Store。

### 1.2 系統大網（邏輯架構）

```
┌─────────────────────────────────────────────────────────────┐
│                     FitBuddy 用戶端                          │
│  Landing / 登入註冊 / Google OAuth / 7 步註冊流程            │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │  學員視圖 (LEARNER)   │  │  教練視圖 (TRAINER)   │         │
│  │  BottomNav 7 tabs     │  │  BottomNav 6 tabs     │         │
│  └──────────┬───────────┘  └──────────┬───────────┘         │
│             │    React + Zustand + React Query + Axios       │
└─────────────┼──────────────────────────┼────────────────────┘
              │  HTTPS /api/*            │
              │  Bearer JWT + HttpOnly refresh cookie          │
┌─────────────▼──────────────────────────▼────────────────────┐
│              Express API（TypeScript + Drizzle）              │
│  auth │ workouts │ plans │ coach-client │ invitations       │
│  nutrition │ food │ analytics │ dashboard │ notifications   │
│  exercises │ ai │ users │ email(admin)                       │
└─────────────┬───────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────┐
│           PostgreSQL（Neon）+ Resend 郵件 + Web Push          │
└───────────────────────────────────────────────────────────────┘
```

### 1.3 用戶角色與入口流程

| 角色 | 前端識別 | 說明 |
|------|----------|------|
| **學員** | `LEARNER` / `USER` | 預設視圖；訓練、飲食、進度、課表 |
| **教練** | `TRAINER` / `COACH` | 課表建立、學員訓練紀錄、營運數據（部分 UI 未完成） |
| **雙角色** | 註冊時可選 `both` | `App.tsx` 可切換 LEARNER ↔ TRAINER 視圖 |

**未登入流程（URL 路由，wouter）：**

| 路徑 | 功能 |
|------|------|
| `/` | Landing 落地頁 |
| `/login` | 登入 |
| `/register-flow` | 7 步註冊（帳號→信箱密碼→TDEE→活動目標→電子報→好友→角色） |
| `/auth/google/callback` | Google OAuth 回調 |
| `/verify-email-prompt` | 信箱驗證提示 |

**已登入主流程：** 非多頁 URL，而以 **底部 Tab** 切換（`ClientRouter` / `CoachRouter`）。

### 1.4 學員端功能（ClientRouter — 7 tabs）

| Tab | 標籤 | 功能 | 成熟度 |
|-----|------|------|--------|
| dashboard | 主頁 | 今日摘要、快捷入口（開始訓練、課表、進度、飲食） | ✅ 可用 |
| workout | 訓練 | 訓練課表列表、進行訓練 session、歷史紀錄、回饋 | ✅ 核心流程 |
| progress | 進度 | 身體組成、趨勢圖表、進度儀表板 | ✅ 可用 |
| plans | 課表 | 教練指派課表、可用課表、開始訓練 | ✅ 可用 |
| food | 飲食 | 餐點記錄、營養追蹤、食物搜尋 | ✅ 可用 |
| social | 社群 | — | ⬜ **placeholder（開發中）** |
| profile | 我 | 通知設定、Web Push 訂閱 | ✅ 可用 |

**學員相關彈層 / 子流程：** 訓練進行 Modal、自由訓練、session 詳情、TDEE 計算（註冊與設定）。

### 1.5 教練端功能（CoachRouter — 6 tabs）

| Tab | 標籤 | 功能 | 成熟度 |
|-----|------|------|--------|
| dashboard | 主頁 | 教練儀表板、快捷操作、開啟課表編輯器 | ✅ 可用 |
| workout | 訓練 | 查看學員訓練歷史、進入學員進度 | ✅ 可用 |
| clients | 學員 | 學員列表與管理 | ⬜ **placeholder（開發中）** |
| schedule | 排表 | 排程管理 | ⬜ **placeholder（開發中）** |
| analytics | 數據 | 教練分析報表 | ⬜ **placeholder（開發中）**；後端 `/api/analytics` 已有 |
| profile | 設定 | 通知設定 | ✅ 可用 |

**教練相關彈層：** Routine Builder（為學員建立課表）、學員進度檢視、升級 Modal。

### 1.6 後端 API 領域（按業務模組）

| 模組 | 主要路徑 | 能力摘要 |
|------|----------|----------|
| **認證** | `/api/auth/*` | 註冊、登入、refresh、logout、Google OAuth、忘記/重設密碼、信箱驗證、token 撤銷 |
| **用戶** | `/api/users`、`/api/v1/users` | 個人資料、username 檢查、TDEE 更新 |
| **邀請** | `/api/v1/invitations`、`/api/invitations`（legacy） | 教練邀請學員、邀請碼狀態、接受邀請 |
| **教練–學員** | `/api/coach/*`、`/api/coaches/*` | 關係建立、學員列表、教練客戶綁定 |
| **訓練課表** | `/api/workouts/routines` | CRUD 課表、動作與組數、指派給學員 |
| **訓練紀錄** | `/api/workouts/sessions` | 開始/完成 session、組數紀錄、教練查看學員紀錄、回饋 |
| **訓練日誌** | `/api/workouts` | 簡化版 workout log（類型、時長、卡路里） |
| **課表計畫** | `/api/plans/*` | 我的課表、可用課表、指派/取消指派 |
| **動作庫** | `/api/exercises` | 搜尋運動動作 |
| **營養** | `/api/nutrition`、`/api/food` | 餐點、營養計畫、食物資料 |
| **儀表板** | `/api/dashboard/*` | 聚合摘要數據 |
| **分析** | `/api/analytics/*` | 訓練量、趨勢（W3 已做 SQL 優化） |
| **通知** | `/api/notifications` | 站內通知、Web Push 訂閱 |
| **AI** | `/api/ai/*` | 課表生成、訓練摘要 |
| **健康檢查** | `/api/health` | 存活探針（CI / 部署用） |
| **郵件管理** | `/api/admin/email` | 郵件日誌（管理用途） |

### 1.7 核心資料實體（Drizzle / PostgreSQL）

| 實體 | 用途 |
|------|------|
| `users` | 帳號、角色、TDEE、OAuth、tokenVersion |
| `invitations` | 邀請碼與狀態 |
| `coach_clients` / `coach_client_relationships` | 教練–學員關係 |
| `workout_routines` + `routine_exercises` + `exercise_sets` | 課表定義 |
| `workout_sessions` + `session_*` | 實際訓練執行紀錄 |
| `plan_assignments` | 課表指派給學員 |
| `meals` / `workouts` | 飲食與簡化訓練日誌 |
| `body_composition_logs` | 身體組成進度 |
| `notifications` / `push_subscriptions` | 通知與推播 |
| `exercises` | 動作資料庫 |

### 1.8 跨領域用戶旅程（主幹）

```
註冊/登入 → 選角色（學員/教練）
    │
    ├─【學員】接受教練邀請 → 查看指派課表 → 開始訓練 session → 記錄組數 → 查看進度
    │                      → 記錄飲食 → 查看營養/趨勢
    │
    └─【教練】發送邀請 → 建立 routine（課表編輯器）→ 指派給學員
                       → 查看學員訓練歷史與回饋 →（analytics 待 UI）
```

### 1.9 功能成熟度總覽

| 領域 | 後端 API | 前端 UI | 備註 |
|------|----------|---------|------|
| 認證 / 安全 | ✅ 強 | ✅ | Phase 7.4 + e2e 覆蓋 |
| 訓練課表 / session | ✅ | ✅ | 核心 MVP |
| 課表指派 plans | ✅ | ✅ | |
| 教練–學員邀請 | ✅ | ✅ | v1 + legacy 並存 |
| 營養 / 飲食 | ✅ | ✅ | 含食物搜尋 |
| 進度 / 圖表 | ✅ | ✅ | |
| 通知 / Web Push | ✅ | ✅ | App 內需改 native push |
| 分析 analytics | ✅ | ⬜ | 教練 tab 為 placeholder |
| 教練學員列表/排表 | 部分 | ⬜ | placeholder |
| 社群 social | — | ⬜ | placeholder |
| AI 輔助 | ✅ | 部分 | 整合於教練/課表流程 |
| iOS App | — | — | 未建；D-4 Capacitor |

**送審前必處理：** 隱藏或完成 §1.4～1.5 中標記 ⬜ 的 tab，避免 App Review 風險。

---

## 2. 專案定位與技術棧（現況）

FitBuddyMVP 是 **全端 Web monorepo**（非 native iOS repo）：

| 層 | 技術 |
|----|------|
| Frontend | React 18、Vite 7、wouter、React Query、Zustand、Axios、Radix/shadcn、Tailwind |
| Backend | Express 4、TypeScript、Drizzle ORM、PostgreSQL（Neon） |
| Auth | JWT Access + HttpOnly Refresh Cookie（P0-2）、Google OAuth |
| 測試 | Vitest（e2e/phase7.4）、Playwright（tests/phase6c）、shell 驗證腳本 |
| CI | .github/workflows/security-gate.yml（Fast + Slow 雙 gate） |

**重要：** repo 內沒有 .xcodeproj / ios/。iOS 上架路線建議為 **Capacitor 薄殼 + staging 同網域 hosted web**（非 React Native 重寫、非 Swift 全原生）。

---

## 3. 我們先前做了什麼（背景與主線脈絡）

### 3.1 四週倒排甘特（W1～W4）

| 週次 | 主題 | 狀態 |
|------|------|------|
| W1 | 5a 安全標頭 + 7.4 安全防線（件 3/5/7/8、P0-2 HttpOnly refresh） | 完成 |
| W2 | 7.2 API 版本治理（PR-1～3、deprecation、invitations） | 完成 |
| W3 | 7.3 效能與索引（PR-1～6、SQL 改寫、8 支 migration、baseline） | 完成 |
| W4 | 上架收斂（CI secrets → RC → TestFlight → 送審） | D-5 完成，D-4～D-1 待做 |

### 3.2 Phase 7 硬化目標

從「可用產品」升級到「可上架、可營運、可擴展」：

- 7.1 錯誤合約（已完成基礎，e2e 斷言仍偏寬鬆）
- 7.2 路由統一與版本治理（已完成）
- 7.3 效能基線與索引（已完成）
- 7.4 安全最小防線 + 授權邊界 e2e（已完成）

### 3.3 本輪對話額外完成的工作

除 W3 封頂外，本輪集中攻克 **W4 D-5：CI Slow E2E**：

1. 診斷 GitHub Actions 無 secrets → DATABASE_URL must be set
2. 設定 GitHub Repository Secrets
3. 修改 security-gate.yml 注入 secrets
4. 連續修復 CI 啟動鏈：Resend API key → 補 cors 依賴
5. 驗收 CI 全綠並更新 0415ARCHITECTURE.md
6. 討論 D-4（RC / TestFlight）與 mobile 路線（Capacitor vs RN vs Swift）

---

## 4. 先前已完成什麼（W1～W3 + Phase 7 摘要）

### 4.1 安全與 Auth（W1 / 7.4）

- Helmet、CORS 白名單、結構化安全事件日誌
- P0-2：refresh token 改 HttpOnly cookie（fitbuddy_refresh_token，path: /api/auth，sameSite: lax）
- access token 存 localStorage（fitbuddy_access_token）
- api-client.ts：withCredentials: true、並發 401 單飛 refresh
- 授權邊界 e2e：e2e/phase7.4/authorization-*.test.ts（含 BOLA）

### 4.2 API 版本治理（W2 / 7.2）

- /api/auth/* 維持無 v1 前綴（刻意為 iOS WebView cookie 路徑保留）
- 新模組走 /api/v1/*；deprecationMiddleware + legacy header
- npm run validate:7.2 靜態守門

### 4.3 效能與索引（W3 / 7.3）

| PR | 內容 |
|----|------|
| PR-1 | server/routes/analytics.ts workout-volume SQL 改寫（去 correlated subquery） |
| PR-1b～6 | 8 支 migration（scripts/migrations/） |
| Baseline | npm run w3:baseline；快照 tmp/w3-baseline-after-w3-summary.txt（gitignored） |

### 4.4 CI（D-5 之前狀態）

- Fast gate（push/PR）：check + validate:7.2 + validate:7.4:static — 一直可用
- Slow E2E（dispatch/cron/label）：長期因缺 secrets 失敗（本輪已修）

---

## 5. 我們目前完成了什麼（W4 D-5）

### 5.1 GitHub Secrets（Repository 層級，已設定）

| Secret | 用途 |
|--------|------|
| DATABASE_URL | Neon dev branch（pooled connection） |
| JWT_SECRET | 與本機 staging/dev 一致 |
| REFRESH_TOKEN_SECRET | 同上 |
| RESEND_API_KEY | emailService.ts 啟動所需 |

**注意：** secrets 值不可進 repo；本機對應 server/.env.local（gitignored）。

### 5.2 相關 Commits（main 近期）

```
f42e5b1 docs: mark W4 D-5 complete after CI Security E2E gate passed
5c6a9e3 fix(deps): add cors for production API server startup in CI
5b40726 fix(ci): inject RESEND_API_KEY for Security E2E slow gate
a62ed5a fix(ci): inject DB and JWT secrets for Security E2E slow gate
```

### 5.3 CI 驗收結果

- Run ID：28456987031
- 結果：Security E2E (Slow) 全綠
- 測試：13 files / 56 tests passed
- 觸發：gh workflow run "Security Gate" --ref main

### 5.4 Slow E2E 啟動鏈（已打通）

```
npm ci → npm run build → node dist/index.js（需 env secrets）
→ /health ready → npm run test:security:e2e
```

曾遇障礙與修復：

1. 缺 DATABASE_URL → 注入 secrets
2. Resend Missing API key → 加 RESEND_API_KEY secret
3. Cannot find module 'cors' → npm install cors

### 5.5 文件

- 0415ARCHITECTURE.md 已更新：§6、§8b、甘特 16/20、D-5 交付摘要

---

## 6. 目前的架構規則（新接手者必讀）

### 6.1 單一真相來源

| 主題 | 規則 |
|------|------|
| 架構文件 | 0415ARCHITECTURE.md 為主；重大變更需滾動更新 |
| DB Schema | server/db/schema.ts + scripts/migrations/ |
| 環境變數 | server/config/env.ts；本機 server/.env.local（不 commit） |
| API 錯誤格式 | 目標：errorCode + message + logId（7.1；e2e 斷言尚未全面收嚴） |

### 6.2 Auth 契約（勿隨意破壞）

- Access: Bearer token（localStorage: fitbuddy_access_token）
- Refresh: HttpOnly cookie（fitbuddy_refresh_token, path=/api/auth, sameSite=lax）
- Client: axios withCredentials: true
- /api/auth/* 不要搬到 /api/v1/auth（文件 §7.2 明確決策）
- logout / tokenVersion revocation 已有 e2e 覆蓋

### 6.3 API 版本策略

- 穩定面（無 v1）：/api/auth/*、/api/health
- 演進面：/api/v1/\<domain\>（如 invitations）
- 舊路由需 deprecationMiddleware + sunset header

### 6.4 CI 守門規則

| Gate | 觸發 | 命令 |
|------|------|------|
| Fast | push / pull_request | check、validate:7.2、validate:7.4:static |
| Slow | workflow_dispatch / cron / PR label run-security-e2e | build + 啟 server + test:security:e2e |

**本機 e2e 前置：** 必須先 npm run dev:backend，再跑 npm run test:security:e2e。

### 6.5 開發慣例

- 最小 diff；不為邊角案例過度抽象
- 不 commit secrets（.env.local、GitHub Secrets 值）
- 只在使用者明確要求時 git commit / push
- migration 用 CONCURRENTLY；勿對 production DB 做實驗
- W3 baseline 產物在 tmp/（gitignored）

### 6.6 已知技術債（仍開放）

| 項目 | 狀態 |
|------|------|
| Error Contract e2e 嚴格 errorCode 斷言 | 刻意寬鬆，待 7.1 一致後收斂 |
| seedActor 用 Date.now()+random | CI 併發高時改 UUID |
| UI placeholder（social、coach clients/schedule/analytics） | 送審前需隱藏或補完 |
| 新舊 auth 頁面並存 | 歷史遷移痕跡 |
| 無 iOS 專案 | D-4 需新建 Capacitor 殼或另 repo |

### 6.7 Mobile / 上架架構決策（本輪結論）

**建議路線（D-4）：** Capacitor iOS 薄殼 + staging 同網域 hosted web

- 理由：現有 React client 可重用；HttpOnly cookie 在同 origin 下最省事
- 不建議現階段：React Native 重寫 UI（4～8 週+）；Swift 全原生（數月）

---

## 7. 關鍵路徑與指令速查

```bash
# 日常開發
npm run dev:backend          # Terminal A
npm run dev:frontend         # Terminal B（或 npm run dev）

# 提交前守門
npm run check
npm run validate:7.2
npm run validate:7.4:static

# 全量安全 e2e（需後端已啟動）
npm run test:security:e2e

# W3 效能 baseline（需 DATABASE_URL）
npm run w3:baseline

# CI Slow E2E 手動觸發
gh workflow run "Security Gate" --ref main

# 建置（與 CI 相同）
npm run build
NODE_ENV=production node dist/index.js
```

### 重要檔案

| 路徑 | 用途 |
|------|------|
| 0415ARCHITECTURE.md | 架構與進度主文件 |
| .github/workflows/security-gate.yml | CI Fast/Slow |
| server/routes/auth.ts | refresh cookie 邏輯 |
| client/src/lib/api-client.ts | token / refresh / axios |
| e2e/phase7.4/ | 安全授權 e2e |
| scripts/validate-7.2.sh / validate-7.4.sh | 靜態守門 |
| scripts/migrations/*.sql | DB 索引 migration |

---

## 8. 下一步要做什麼（W4 D-4～D-1）

### D-4 RC + TestFlight（約 1 工作日）

**後端 / 本 repo：**

1. 部署 staging（單一 HTTPS 網域：SPA + /api 同 origin）
2. 設定 staging env：DATABASE_URL、JWT_*、CORS_ORIGIN、CLIENT_URL、VITE_API_BASE_URL
3. 跑冒煙：Fast gate + Slow E2E
4. 隱藏或補完「開發中」placeholder 頁面

**iOS（需新建）：**

1. npx cap init + @capacitor/ios
2. capacitor.config.ts 建議 RC1 用 hosted URL 指向 staging
3. Xcode Archive → Upload → TestFlight 內部測試

### D-3：RC 修復 + 法遵

- TestFlight feedback 修 P0/P1
- 隱私權政策 URL、刪除帳號流程
- Google 登入 → 準備 Sign in with Apple

### D-2：Go/No-Go

- CI Fast + Slow 全綠
- 401 錯誤率監控 24～48h 就緒

### D-1：App Store 送審

- 預留 5～7 天審核緩衝

### 時程粗估

| 階段 | 預估 |
|------|------|
| 團隊工作（D-4～D-1） | 約 4～5 個工作日 |
| Apple 審核 | 約 5～7 個日曆天 |
| 實際上架 | 送審後約 2～3 週 |

---

## 9. 風險與注意事項

1. Secrets 安全：若疑慮外洩，應在 Neon rotate password 並更新 GitHub secret
2. CI Slow 非 push 必檢：重大 API/auth 變更應手動跑 Slow
3. Neon DB：staging 建議獨立 branch，避免 e2e 污染
4. Capacitor hosted 審核：需確保核心流程完整、無 placeholder
5. tmp/ 未追蹤：新環境需重跑 w3:baseline

---

## 10. 給下一位架構師的第一週建議

| 優先級 | 任務 |
|--------|------|
| P0 | 確認 staging 部署與 env 清單 |
| P0 | Capacitor iOS 最小殼 + TestFlight RC1 |
| P1 | 清除送審 blocker（placeholder、Sign in with Apple） |
| P1 | 更新 0415ARCHITECTURE.md D-4 狀態 |
| P2 | seedActor → UUID、errorCode 嚴格斷言（非上架阻塞） |

---

## 11. 一句話交接

**W1～W3 與 W4 D-5 已封頂（含 CI Slow E2E 56 tests 全綠）；下一個架構師的主線是 D-4：staging 部署 + Capacitor iOS 薄殼 + TestFlight RC1，並在 D-3～D-1 完成法遵、Go/No-Go 與 App Store 送審。**

---

*細節以 0415ARCHITECTURE.md 與 main 分支程式碼為準。*
