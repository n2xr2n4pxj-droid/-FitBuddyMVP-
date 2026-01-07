# 🚨 緊急安全修復 - .env 文件暴露

## 問題嚴重性
GitGuardian 檢測到 `.env` 文件被提交到 GitHub，包含真實的敏感信息：
- **DATABASE_URL**: `postgresql://neondb_owner:npg_f6xQICEa3Arc@...` (真實的數據庫連接字符串)
- **SESSION_SECRET**: `fitbuddy-dev-secret-key-2024`
- **USDA_API_KEY**: `bbxc7LVv2awhyHMje6IifRed0iMJWcpaPwtlD4YX`

## ⚠️ 立即行動步驟

### 1. 立即撤銷和輪換所有暴露的密鑰（最高優先級）

#### DATABASE_URL (Neon PostgreSQL)
1. 登入 [Neon Console](https://console.neon.tech)
2. 找到你的數據庫項目
3. **重置數據庫密碼**
4. 更新 `server/.env.local` 中的新 `DATABASE_URL`

#### SESSION_SECRET
1. 生成新的 session secret:
   ```bash
   openssl rand -base64 32
   ```
2. 更新 `server/.env.local` 中的 `SESSION_SECRET`

#### USDA_API_KEY
1. 訪問 [USDA API 網站](https://fdc.nal.usda.gov/api-guide.html)
2. **重新生成新的 API key**
3. 更新 `server/.env.local` 中的 `USDA_API_KEY`

### 2. 從 Git 歷史中移除 .env 文件

即使當前分支中沒有，也可能存在於遠程倉庫的其他分支或舊 commit 中。

```bash
# 從所有分支的歷史中移除 .env 文件
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# 清理
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 強制推送到所有分支
git push --force --all origin
```

### 3. 確保 .gitignore 已更新

✅ 已完成：`.gitignore` 已更新，包含：
```
.env
.env.*
!.env.example
*.env
```

### 4. 創建 .env.example 模板

創建一個不包含真實值的示例文件：

```bash
# .env.example
DATABASE_URL=postgresql://username:password@host:port/database
SESSION_SECRET=your-session-secret-here
USDA_API_KEY=your-usda-api-key-here
SENDGRID_API_KEY=your-sendgrid-api-key-here
```

## 後續檢查

1. ✅ 在 GitGuardian 中確認警報已解決
2. ✅ 檢查 GitHub 倉庫的 Security 標籤頁
3. ✅ 確認所有環境變量都已更新為新值
4. ✅ 測試應用程序是否正常運行

## 預防措施

1. ✅ 永遠不要提交 `.env` 文件
2. ✅ 使用 `.env.example` 作為模板
3. ✅ 在每次提交前執行安全掃描
4. ✅ 使用 Git hooks 防止意外提交敏感文件

---
**創建時間**: 2025-01-08
**緊急程度**: 🔴 最高優先級

