# 🔧 DB Push 錯誤修復

## ❌ 錯誤信息

```
require is not defined in ES module scope, you can use import instead
```

## 🔍 問題原因

`db:push` 腳本沒有指定配置文件，默認嘗試使用 `drizzle.config.ts`，導致 ES 模塊錯誤。

## ✅ 解決方案

已更新 `package.json` 中的腳本：

### 修復前：
```json
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio",
```

### 修復後：
```json
"db:push": "drizzle-kit push --config=drizzle.config.cjs",
"db:studio": "drizzle-kit studio --config=drizzle.config.cjs",
```

## 📋 所有 Drizzle 腳本

現在所有 drizzle-kit 命令都使用 CommonJS 配置文件：

- ✅ `db:generate` → `drizzle-kit generate --config=drizzle.config.cjs`
- ✅ `db:push` → `drizzle-kit push --config=drizzle.config.cjs`
- ✅ `db:studio` → `drizzle-kit studio --config=drizzle.config.cjs`

## 🎯 使用方法

現在可以正常執行：

```bash
# 生成 migrations
npm run db:generate


# 應用 migrations 到資料庫
npm run db:push

# 打開 Drizzle Studio
npm run db:studio
```

## ⚠️ 注意事項

執行 `db:push` 前：
1. ✅ 確保已備份資料庫
2. ✅ 確認 migration 文件正確
3. ✅ 檢查資料庫連接正常

