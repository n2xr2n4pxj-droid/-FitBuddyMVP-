# Phase 1 任務表 — Capacitor Hosted 薄殼路線（定案版）

**記錄日期：** 2026-07-07  
**路線：** Capacitor iOS 薄殼 + **staging 同網域 hosted web**（非 RN / 非全頁搬移）  
**Phase 1 目標：** Staging 上線 → iOS RC1 → TestFlight **內部**冒煙通過  
**不含：** App Store 正式送審（Phase 2）、Android 殼、Sign in with Apple

---

## 定案時程

| 指標 | 定案數字 | 說明 |
|------|----------|------|
| **工程人天** | **10 人天** | 含 C4 Google OAuth 系統瀏覽器方案 +0.5d 緩衝 |
| **日曆時間** | **約 4～5 週** | 以每天 **3～4 小時** 投入計算，**含緩衝** |
| App Store 審核 | Phase 2 另計 | **5～7 日曆天**（不併入 Phase 1 人天） |

### 日曆時間怎麼來（勿用 2～3 週）

```
10 人天 ÷（每天 3～4h ≈ 0.4～0.5 人天/日）≈ 20～25 個投入日
→ 含週末、阻塞、OAuth 政策調試 → 實務抓 **4～5 週日曆**
```

一人公司若以「全職 8h/天」心態排 2～3 週，在 3～4h/天現實下會變成 **6～10 週**，造成排程一再後拖。文件與對外承諾請用 **4～5 週**。

---

## 里程碑

| 代號 | 目標 | 建議週次 |
|------|------|----------|
| M1 | Staging Live（HTTPS 單網域 SPA+API） | W1 |
| M2 | Web 修補（mock/placeholder/OAuth 方案） | W1～W2 |
| M3 | Capacitor iOS 殼可 Archive | W2～W3 |
| M4 | TestFlight RC1 上傳 | W3 |
| M5 | 內測冒煙 12 項全過 → Phase 1 封頂 | W4～W5 |

---

## 完整任務表

### S — Staging 部署（2.5 人天）

| ID | 任務 | 主要檔案/位置 | 類別 | 人天 | DoD |
|----|------|---------------|------|------|-----|
| S1 | Neon **staging branch** + 跑 migration | `scripts/migrations/` | 阻塞 | 0.5 | 獨立 DB，非 production |
| S2 | 部署單網域 HTTPS（`npm run build` + `node dist/index.js`） | 部署平台 | 阻塞 | 1.0 | `curl https://<domain>/health` 200 |
| S3 | staging env 清單（見下） | 部署 secrets / `server/.env` 範本 | 阻塞 | 0.5 | CORS、JWT、VITE_* 齊全 |
| S4 | 同 origin 登入 + refresh cookie 驗證 | 瀏覽器 / `api-client.ts` | 阻塞 | 0.5 | 登入→重整不 401 |

**Staging 必設 env：**

```bash
NODE_ENV=production
DATABASE_URL=<neon-staging>
JWT_SECRET= REFRESH_TOKEN_SECRET= SESSION_SECRET=
RESEND_API_KEY=
CORS_ORIGIN=https://staging.<domain>
CLIENT_URL= APP_URL= https://staging.<domain>
VITE_API_BASE_URL=https://staging.<domain>   # 同 origin 可與 APP_URL 相同
VITE_GOOGLE_CLIENT_ID=<oauth-client>
```

---

### W — Web 修補（1.5 人天）

| ID | 任務 | 主要檔案 | 類別 | 人天 | DoD |
|----|------|----------|------|------|-----|
| W1 | 移除飲食 mock plan | `client/src/pages/client/NutritionPage.tsx` | 阻塞 | 0.5 | 無 `MOCK_NUTRITION_PLAN` fallback |
| W2 | TDEE 註冊寫入鏈路 E2E 驗證 | `RegisterFlow.tsx`, `Step3/4` | 阻塞 | 0.5 | 註冊後 DB 有 TDEE |
| W3 | 隱藏 placeholder tabs | `ClientRouter.tsx`, `CoachRouter.tsx`, `BottomNav.tsx` | 阻塞·審核 | 0.5 | 主流程無「開發中」 |

**隱藏清單：** `social`、`clients`、`schedule`、`analytics`

---

### C — Capacitor iOS 殼（3.0 人天 + OAuth 緩衝見 T/C4）

| ID | 任務 | 主要檔案 | 類別 | 人天 | DoD |
|----|------|----------|------|------|-----|
| C1 | Capacitor init + **hosted** `server.url` | `capacitor.config.ts` | 核心 | 0.5 | 指向 staging HTTPS |
| C2 | `cap add ios` + signing + icon/splash | `ios/` | 核心 | 1.0 | Xcode Archive 無簽章錯 |
| C3 | Safe Area + 鍵盤適配 | 全域 CSS / `index.css` | 核心 | 0.5 | 瀏海/底部不被擋 |
| C4 | Google OAuth（**系統瀏覽器**，非 WebView 內） | `@capacitor/browser` 或 auth session | **高風險** | 1.0 | 無 `disallowed_useragent` |

**C4 說明：** Google 禁止在嵌入式 WKWebView 完成 OAuth。RC1 必須用 **跳轉 Safari / ASWebAuthenticationSession** 再回 App；此項已含在 10 人天內，不再另加模組。

**`capacitor.config.ts` 範例：**

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'hk.fitbuddy.app',
  appName: 'FitBuddy',
  webDir: 'dist/public',
  server: {
    url: 'https://staging.<你的網域>',
    cleartext: false,
  },
  ios: { contentInset: 'automatic' },
};

export default config;
```

---

### T — 測試與 TestFlight（2.5 人天）

| ID | 任務 | 位置 | 類別 | 人天 | DoD |
|----|------|------|------|------|-----|
| T1 | Archive + Upload App Store Connect | Xcode / ASC | 核心 | 0.5 | build Processing |
| T2 | TestFlight 內測 + **12 項冒煙** | ASC + 真機 | 核心 | 1.5 | 清單全勾 |
| T3 | CI Slow E2E 回歸（可選） | `gh workflow run "Security Gate"` | 回歸 | 0.5 | 56 tests 綠 |

---

## 人天合計（定案）

| 模組 | 人天 |
|------|------|
| S Staging | 2.5 |
| W Web 修補 | 1.5 |
| C Capacitor iOS | 3.0 |
| T 測試 / TestFlight | 2.5 |
| **合計** | **9.5** |
| C4 OAuth 政策緩衝（已併入 C4 估算） | +0.5 |
| **定案總量** | **10 人天** |

---

## RC1 冒煙清單（T2 必跑）

| # | 場景 | 學員 | 教練 |
|---|------|:----:|:----:|
| 1 | 新安裝開啟不 crash | ✓ | ✓ |
| 2 | Email 登入 / 登出 | ✓ | — |
| 3 | Google OAuth（系統瀏覽器方案） | ✓ | ✓ |
| 4 | refresh 失效（登出後） | ✓ | — |
| 5 | LEARNER ↔ TRAINER 切換 | — | ✓ |
| 6 | 教練邀請 → 學員接受 | ✓ | ✓ |
| 7 | 教練建 routine → 指派 | — | ✓ |
| 8 | 學員開始訓練 → 完成 session | ✓ | — |
| 9 | 訓練歷史 / 進度 | ✓ | — |
| 10 | 飲食記錄 | ✓ | — |
| 11 | 弱網錯誤提示（不白屏） | ✓ | — |
| 12 | 無「開發中」placeholder | ✓ | ✓ |

---

## 明確不做（Phase 1 範圍外）

| 項目 | 歸屬 |
|------|------|
| Sign in with Apple | **Phase 2**（送審前，約 2～3 人天） |
| App Store 送審 + 審核來回 | **Phase 2**（5～7 **日曆天**） |
| Android 殼 | 另開 |
| 教練唯讀飲食 / ClientSelector 等新功能 | Feature backlog |
| 各頁「搬移」至 Capacitor | **hosted 不需要** |
| React Native / Swift 重寫 | 不採用 |

---

## 關鍵路徑

```
S1→S2→S3→S4（Staging）
  → W1→W2→W3（Web 修補）
    → C1→C2→C3→C4（iOS 殼 + OAuth）
      → T1→T2（TestFlight + 冒煙）
```

**並行建議：** W1～W3 與 S2 並行；C2 圖示與 S2 並行。

---

## 風險登記

| 風險 | 緩解 |
|------|------|
| Google `disallowed_useragent` | C4 系統瀏覽器方案（已計入 10 人天） |
| HttpOnly cookie 跨域失敗 | **必須** staging 同網域 hosted |
| 投入時間不足導致拖期 | 對外承諾 **4～5 週日曆**，非 2～3 週 |
| placeholder 審核/內測差評 | W3 隱藏未完成 tab |
| 冒煙 **#3** OAuth 首次串接卡關 | 見下方 **C4 除錯備忘**；卡 1～2 天常見，不代表估期錯誤 |
| 冒煙 **#11** 弱網在 WebView 行為不同 | 真機用 Network Link Conditioner / 飛航模式；預留額外耐心 |

### C4 除錯備忘（Google OAuth 系統瀏覽器跳轉）

平常 Web 開發較少測、Capacitor **第一次串接常出包**的環節。卡關多半是設定未對齊，**不代表任務表估錯**。

**必對齊的設定：**

1. **Google Cloud Console**
   - OAuth 用戶端：iOS +（若用 Web flow）Web 類型
   - **Redirect URI** 含 Capacitor callback（例：`com.googleusercontent.apps.<id>:/oauth2redirect` 或自訂 `hk.fitbuddy.app://...`）

2. **Xcode `Info.plist`**
   - `CFBundleURLTypes` / **URL Scheme** 與 Google / 自訂 scheme 一致
   - 漏設 → Safari 登入成功但 **跳不回 App**

3. **Capacitor 回調**
   - `@capacitor/browser` 或 `ASWebAuthenticationSession` 關閉時機
   - `appUrlOpen` / deep link 監聽已註冊
   - hosted 模式下 **staging 網域** OAuth callback 路徑與 Console 一致

**症狀對照：**

| 現象 | 常見原因 |
|------|----------|
| `disallowed_useragent` | 仍在 WKWebView 內做 OAuth → 改系統瀏覽器 |
| 登入完 Safari 不跳回 App | URL scheme / redirect URI 未設對 |
| 跳回 App 但 401 / 未登入 | cookie 跨域；hosted 應 **同 origin** |

### 冒煙 #3 / #11 注意（真機測時多留耐心）

| 項 | Web 冒煙 | Capacitor 真機 |
|----|----------|----------------|
| **#3 Google OAuth** | 同頁 redirect，多半一次過 | App → 系統瀏覽器 → 回 App；任一環節錯即失敗 |
| **#11 弱網** | 瀏覽器自有離線/錯誤頁 | WebView 易 **白屏、無提示、請求掛死**；需驗 `offline-manager` 與錯誤 UI |

**#11 建議測法：** iOS 設定 → 開發者 → Network Link Conditioner（或飛航模式切換）。通過標準：**不 crash、不無限轉圈、有一句可理解的錯誤提示**。

---

## Phase 1 交付物

- [ ] Staging URL + env runbook
- [ ] `capacitor.config.ts` + `ios/`（可 commit）
- [ ] TestFlight RC1 build 號記錄
- [ ] 冒煙 12 項簽核
- [ ] P0/P1 issue 清單
- [ ] `0415ARCHITECTURE.md` D-4 狀態更新
- [ ] Phase 2 Go/No-Go（是否送審）

---

## 一句話

**10 工程人天、4～5 週日曆（3～4h/天含緩衝）完成 Capacitor hosted RC1 與 TestFlight 內測；送審與 Sign in with Apple 留 Phase 2。**
