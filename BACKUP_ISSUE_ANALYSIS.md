# 🔍 備份失敗問題分析

## ❌ 錯誤信息

```bash
pg_dump: error: connection to server on socket "/tmp/.s.PGSQL.5432" failed: FATAL:  database "gordon" does not exist
```

## 🔍 問題原因

### 1. 環境變量未正確加載

**錯誤操作：**
```bash
source .env.local  # ❌ 文件不存在於根目錄
```

**實際情況：**
- 環境變量文件在 `server/.env.local`
- `DATABASE_URL` 未設置到 shell 環境中
- `pg_dump` 無法讀取 `DATABASE_URL`

### 2. pg_dump 的默認行為

當 `DATABASE_URL` 環境變量未設置時：
- `pg_dump` 會嘗試連接本地 PostgreSQL 服務器
- 使用默認 socket：`/tmp/.s.PGSQL.5432`
- 使用當前用戶名作為資料庫名：`gordon`
- 因此出現錯誤：`database "gordon" does not exist`

### 3. DATABASE_URL 格式

從 `server/.env.local` 讀取到的值：
```
DATABASE_URL=postgres://username@localhost:5432/database_name
```

這是正確的 PostgreSQL 連接字符串格式（示例）。

## ✅ 解決方案

### 方法 1: 使用提供的備份腳本（推薦）

```bash
cd /Users/gordon/Desktop/FitBuddyMVP
./backup-db.sh
```

### 方法 2: 手動加載環境變量

```bash
cd /Users/gordon/Desktop/FitBuddyMVP

# 從 server/.env.local 讀取並設置 DATABASE_URL
export DATABASE_URL=$(grep DATABASE_URL server/.env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')

# 驗證（只顯示前40個字符，不顯示密碼）
echo "DATABASE_URL: ${DATABASE_URL:0:40}..."

# 執行備份
BACKUP_FILE="fitbuddy_backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

echo "✅ 備份完成: $BACKUP_FILE"
```

### 方法 3: 使用 dotenv-cli

```bash
# 安裝 dotenv-cli（如果未安裝）
npm install -g dotenv-cli

# 執行備份
npx dotenv -e server/.env.local -- sh -c 'pg_dump "$DATABASE_URL" > backup.sql'
```

## 🔧 測試連接

在備份前，先測試資料庫連接：

```bash
# 設置環境變量
export DATABASE_URL=$(grep DATABASE_URL server/.env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')

# 測試連接
psql "$DATABASE_URL" -c "SELECT version();"
```

如果連接成功，會顯示 PostgreSQL 版本信息。

## 📋 環境變量文件位置

根據代碼配置，環境變量文件應該在以下位置（按優先級）：

1. **`server/.env.local`** ✅ （當前使用）
2. **`.env`** （根目錄，如果存在）

代碼會按順序嘗試加載這些文件：
- `server/db.ts`: `server/.env.local` → `.env` → 系統環境變量
- `drizzle.config.ts`: `server/.env.local` → `.env` → 系統環境變量

## ⚠️ 注意事項

1. **不要直接 source .env.local**
   - `.env.local` 文件可能包含特殊字符
   - 應該使用 `export` 或腳本讀取

2. **備份文件位置**
   - 建議創建 `backups/` 目錄存放備份
   - 備份文件可能包含敏感數據，妥善保管

3. **定期備份**
   - 建議在執行 migrations 前備份
   - 可以設置自動備份腳本

## 🎯 快速修復命令

```bash
cd /Users/gordon/Desktop/FitBuddyMVP

# 一行命令完成備份
export DATABASE_URL=$(grep DATABASE_URL server/.env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ') && \
BACKUP_FILE="fitbuddy_backup_$(date +%Y%m%d_%H%M%S).sql" && \
pg_dump "$DATABASE_URL" > "$BACKUP_FILE" && \
echo "✅ 備份完成: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
```

