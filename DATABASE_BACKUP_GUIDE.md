# 🗄️ 資料庫備份指南

## ❌ 問題診斷

### 錯誤信息
```
pg_dump: error: connection to server on socket "/tmp/.s.PGSQL.5432" failed: FATAL:  database "your_database" does not exist
```

### 問題原因

1. **`DATABASE_URL` 環境變量未設置**
   - `echo $DATABASE_URL` 返回空值
   - `source .env.local` 失敗（文件不存在於根目錄）

2. **環境變量文件位置不正確**
   - 嘗試從根目錄讀取 `.env.local`，但文件可能在其他位置
   - 根據 `server/db.ts` 和 `drizzle.config.ts`，環境變量應該在：
     - `server/.env.local`
     - 根目錄 `.env`

## 🔍 檢查環境變量文件

### 步驟 1: 查找環境變量文件

```bash
# 檢查根目錄
ls -la | grep .env

# 檢查 server 目錄
ls -la server/ | grep .env

# 查找所有 .env 文件
find . -maxdepth 2 -name ".env*" -type f
```

### 步驟 2: 檢查 DATABASE_URL 配置

```bash
# 如果文件在 server/.env.local
cat server/.env.local | grep DATABASE_URL

# 如果文件在根目錄 .env
cat .env | grep DATABASE_URL
```

## ✅ 正確的備份方法

### 方法 1: 從 server/.env.local 加載環境變量

```bash
cd /path/to/your/project

# 加載環境變量（如果文件在 server/.env.local）
export $(cat server/.env.local | grep -v '^#' | xargs)

# 或者使用 dotenv-cli（如果已安裝）
npx dotenv -e server/.env.local -- pg_dump $DATABASE_URL > backup.sql
```

### 方法 2: 直接指定 DATABASE_URL

```bash
cd /path/to/your/project

# 從環境變量文件讀取 DATABASE_URL
DATABASE_URL=$(grep DATABASE_URL server/.env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'")

# 備份資料庫
BACKUP_FILE="fitbuddy_backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

echo "✅ 備份完成: $BACKUP_FILE"
```

### 方法 3: 使用 Node.js 腳本（推薦）

創建 `backup-db.mjs`：

```javascript
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 讀取環境變量
function loadEnv() {
  const envPaths = [
    resolve(__dirname, 'server', '.env.local'),
    resolve(__dirname, '.env'),
  ];

  for (const envPath of envPaths) {
    try {
      const envContent = readFileSync(envPath, 'utf-8');
      const envVars = {};
      
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            envVars[key.trim()] = value;
          }
        }
      });
      
      return envVars;
    } catch (err) {
      // 文件不存在，繼續嘗試下一個
    }
  }
  
  throw new Error('找不到環境變量文件');
}

try {
  const env = loadEnv();
  const databaseUrl = env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 未設置');
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFile = `fitbuddy_backup_${timestamp}.sql`;
  
  console.log('📦 開始備份資料庫...');
  console.log(`📁 備份文件: ${backupFile}`);
  
  execSync(`pg_dump "${databaseUrl}" > "${backupFile}"`, { stdio: 'inherit' });
  
  console.log(`✅ 備份完成: ${backupFile}`);
} catch (error) {
  console.error('❌ 備份失敗:', error.message);
  process.exit(1);
}
```

執行：
```bash
node backup-db.mjs
```

## 🔧 快速修復命令

### 如果環境變量在 server/.env.local

```bash
cd /path/to/your/project

# 方法 A: 使用 source（需要先處理文件格式）
set -a
source <(cat server/.env.local | grep -v '^#' | sed 's/^/export /')
set +a

# 方法 B: 直接讀取並設置
export DATABASE_URL=$(grep DATABASE_URL server/.env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')

# 驗證
echo "DATABASE_URL: ${DATABASE_URL:0:30}..." # 只顯示前30個字符（安全）

# 備份
BACKUP_FILE="fitbuddy_backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE" && echo "✅ 備份完成: $BACKUP_FILE" || echo "❌ 備份失敗"
```

## ⚠️ 注意事項

1. **DATABASE_URL 格式**
   - PostgreSQL: `postgresql://user:password@host:port/database`
   - Neon: `postgresql://user:password@host.neon.tech/database?sslmode=require`

2. **權限問題**
   - 確保 `pg_dump` 已安裝
   - 確保有資料庫連接權限

3. **備份文件大小**
   - 大型資料庫可能需要較長時間
   - 檢查磁盤空間是否足夠

4. **安全**
   - 不要在終端直接顯示完整的 `DATABASE_URL`（包含密碼）
   - 備份文件可能包含敏感數據，妥善保管

## 🧪 測試連接

在備份前，先測試連接：

```bash
# 設置環境變量
export DATABASE_URL=$(grep DATABASE_URL server/.env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')

# 測試連接
psql "$DATABASE_URL" -c "SELECT version();"
```

如果連接成功，再執行備份。

