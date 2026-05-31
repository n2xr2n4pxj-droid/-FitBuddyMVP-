# ✅ Drizzle Generate 錯誤修復總結

## ❌ 原始錯誤

```
require is not defined in ES module scope, you can use import instead
```

## 🔍 問題原因

1. **項目使用 ES 模塊**：`package.json` 中設置了 `"type": "module"`
2. **drizzle-kit 內部使用 require()**：在加載 TypeScript 配置文件時，drizzle-kit 內部使用了 `require()`
3. **ES 模塊環境限制**：在 ES 模塊環境中，`require()` 不可用

## ✅ 解決方案

### 創建 CommonJS 格式的配置文件

創建了 `drizzle.config.cjs`（CommonJS 格式），使用 `require()` 和 `module.exports`：

```javascript
const { defineConfig } = require('drizzle-kit');
const dotenv = require('dotenv');
const path = require('path');

// 加載環境變量
dotenv.config({ path: path.resolve(__dirname, 'server', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Please check your .env file.');
}

module.exports = defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

### 更新 package.json

更新了 `db:generate` 腳本，明確指定使用 `.cjs` 配置文件：

```json
"db:generate": "drizzle-kit generate --config=drizzle.config.cjs"
```

## 📋 文件狀態

- ✅ `drizzle.config.cjs` - CommonJS 格式（用於 drizzle-kit）
- ✅ `drizzle.config.ts` - TypeScript 格式（保留，可用於其他工具）
- ✅ `package.json` - 已更新腳本

## 🎯 使用方法

現在可以正常執行：

```bash
npm run db:generate
```

這會：
1. 讀取 `drizzle.config.cjs`
2. 加載環境變量
3. 讀取 `server/db/schema.ts`
4. 生成 migration 文件到 `drizzle/` 目錄

## ⚠️ 注意事項

1. **兩個配置文件共存**：
   - `drizzle.config.ts` - 保留用於類型檢查和 IDE 支持
   - `drizzle.config.cjs` - 實際用於 drizzle-kit

2. **保持同步**：
   - 如果修改配置，需要同時更新兩個文件
   - 或者只使用 `.cjs` 文件，刪除 `.ts` 文件

3. **環境變量**：
   - 確保 `server/.env.local` 或 `.env` 中存在 `DATABASE_URL`

