# FitBuddy 環境變量遷移指南

> **更新日期**: 2026-01-12  
> **適用於**: 所有開發者

---

## 📋 快速開始

### 新開發者設置

1. **克隆項目**
   ```bash
   git clone <repository-url>
   cd FitBuddyMVP
   ```

2. **設置後端環境變量**
   ```bash
   # 複製範本
   cp .env.example server/.env.local
   
   # 編輯並填入真實值
   # 注意：只複製後端需要的變量（非 VITE_ 開頭的）
   ```

3. **設置前端環境變量**
   ```bash
   # 創建前端環境變量文件
   # 從 .env.example 複製 VITE_ 開頭的變量
   cat > client/.env.local << 'EOF'
   VITE_API_BASE_URL=/api
   VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   VITE_GOOGLE_CALLBACK_URL=http://localhost:5173/auth/callback
   VITE_APP_NAME=FitBuddy
   VITE_APP_VERSION=1.0.0
   EOF
   ```

4. **驗證配置**
   ```bash
   npm run env:check
   ```

5. **啟動應用**
   ```bash
   npm run dev
   ```

---

## 🔄 現有開發者遷移

如果你已經有 `client/.env.local` 和 `server/.env.local`，只需要：

1. **檢查配置是否完整**
   ```bash
   npm run env:check
   ```

2. **更新變量命名**（如果需要）
   - 檢查 `.env.example` 中的變量名
   - 確保你的 `.env.local` 文件使用相同的變量名
   - 特別是 `GOOGLE_CLIENT_ID`（不是 `GOOGLE_OAUTH_ID`）

3. **測試應用**
   ```bash
   npm run dev
   ```

---

## 📁 文件結構

```
FitBuddyMVP/
├── .env.example          # 📋 完整範本（包含所有變量）
├── client/
│   └── .env.local        # 🎨 前端環境變量（VITE_ 開頭）
└── server/
    └── .env.local        # 🔌 後端環境變量（非 VITE_ 開頭）
```

### 加載優先級

#### 後端環境變量加載順序（`server/config/env.ts`）
1. 系統環境變量（最低優先級）
2. 根目錄 `.env`
3. 根目錄 `.env.local`
4. `server/.env.local`（最高優先級，本地開發用）

#### 前端環境變量加載順序（Vite 自動）
1. `client/.env.local`（最高優先級）
2. `client/.env.development` / `client/.env.production`
3. `client/.env`

---

## 🔑 環境變量說明

### 後端變量（`server/.env.local`）

#### 必需變量
- `DATABASE_URL` - 數據庫連接字符串
- `JWT_SECRET` - JWT 簽名密鑰
- `REFRESH_TOKEN_SECRET` - Refresh Token 密鑰
- `SESSION_SECRET` - Session 加密密鑰
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret

#### 可選變量
- `NODE_ENV` - 環境模式（development/production）
- `PORT` - 服務器端口（默認: 3000）
- `GOOGLE_CALLBACK_URL` - Google OAuth 回調 URL
- `SENDGRID_API_KEY` - SendGrid API Key（郵件服務）
- `ACCESS_TOKEN_EXPIRATION` - Access Token 過期時間（默認: 7d）
- `REFRESH_TOKEN_EXPIRATION` - Refresh Token 過期時間（默認: 30d）

### 前端變量（`client/.env.local`）

#### 必需變量
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth Client ID（前端使用）

#### 可選變量
- `VITE_API_BASE_URL` - API 基礎 URL（默認: /api）
- `VITE_GOOGLE_CALLBACK_URL` - Google OAuth 回調 URL
- `VITE_APP_NAME` - 應用名稱
- `VITE_APP_VERSION` - 應用版本

**注意**: 前端變量必須以 `VITE_` 開頭，否則 Vite 不會加載。

---

## 🛠️ 常用命令

```bash
# 檢查環境變量配置
npm run env:check

# TypeScript 類型檢查
npm run check

# 啟動開發服務器
npm run dev

# 構建生產版本
npm run build
```

---

## ❓ 常見問題

### Q: 為什麼前端和後端需要分開的 .env.local 文件？

**A**: 
- 前端變量（`VITE_*`）會被打包到客戶端代碼中，任何人都可以看到
- 後端變量包含敏感信息（如 JWT_SECRET），絕對不能暴露到前端
- 分開管理更安全，也符合前後端分離的架構

### Q: 我可以使用根目錄的 .env 文件嗎？

**A**: 
- 可以，但 `server/.env.local` 的優先級更高
- 建議使用 `server/.env.local` 和 `client/.env.local`，更清晰

### Q: 如何為不同環境設置不同的配置？

**A**: 
- 開發環境：使用 `.env.local`（不提交到 Git）
- 生產環境：使用系統環境變量或 CI/CD 配置
- 未來可以支持 `.env.development` 和 `.env.production`

### Q: 配置加載不生效怎麼辦？

**A**: 
1. 檢查文件路徑是否正確
2. 檢查變量名是否正確（注意大小寫）
3. 檢查是否有語法錯誤（如缺少引號）
4. 運行 `npm run env:check` 檢查
5. 重啟開發服務器

### Q: 如何生成安全的 JWT_SECRET？

**A**: 
```bash
# 使用 Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 或使用 openssl
openssl rand -hex 64
```

---

## 🔒 安全注意事項

1. **永遠不要提交 `.env.local` 文件到 Git**
   - 已通過 `.gitignore` 防護
   - 如果意外提交，立即輪換所有 secrets

2. **生產環境必須設置所有必需變量**
   - 應用會在啟動時驗證
   - 缺少必需變量會導致應用無法啟動

3. **不要在前端變量中包含後端 secrets**
   - 前端變量會被打包到客戶端
   - 任何人都可以在瀏覽器中看到

4. **定期輪換 secrets**
   - 特別是如果懷疑泄露
   - 使用強隨機字符串生成

---

## 📚 相關文檔

- [環境變量架構分析報告](./ENV_MANAGEMENT_ARCHITECTURE_ANALYSIS.md)
- [README.md](./README.md)

---

**如有問題，請聯繫項目維護者**
