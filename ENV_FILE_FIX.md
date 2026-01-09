# .env 文件安全修復方案

## 問題
GitGuardian 檢測到 `.env` 文件被提交到 GitHub，包含：
- DATABASE_URL (真實的 PostgreSQL 連接字符串)
- SESSION_SECRET
- USDA_API_KEY

## 當前狀態
- ✅ 已更新 .gitignore 確保所有 .env 文件都被忽略
- ⚠️ 需要檢查遠程倉庫的所有分支

## 修復步驟

### 1. 如果 .env 文件在遠程 main 分支中
```bash
# 切換到 main 分支
git checkout main
git pull origin main

# 檢查是否有 .env 文件
git ls-files | grep "\.env$"

# 如果存在，從 Git 中移除
git rm --cached .env
git commit -m "security: remove .env file from repository"

# 推送到遠程
git push origin main
```

### 2. 從所有分支的歷史中移除 .env 文件
```bash
# 使用 git filter-branch 從所有分支歷史中移除
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

### 3. 立即撤銷和輪換所有暴露的密鑰
- DATABASE_URL: 在 Neon 控制台中重置數據庫密碼
- SESSION_SECRET: 生成新的 session secret
- USDA_API_KEY: 在 USDA API 網站上重新生成新的 API key

## 預防措施
- ✅ .gitignore 已更新，包含所有 .env 文件模式
- ✅ 使用 .env.example 作為模板（不包含真實值）
