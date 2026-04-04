# 將 DB 調整為與 schema 一致（UUID 外鍵）— 步驟說明

此文件提供**具體 SQL / Drizzle 指令順序**，把資料庫結構調整到與 `server/db/schema.ts` 完全一致，並解決 e2e 的 500 / FK 違反問題。

---

## 前提

- **`users.id` 必須已是 `varchar` (UUID)**。若目前是 `integer`，請先單獨遷移 `users` 表（或使用 Neon 預設的 UUID）。
- 此遷移會**清空**下列表：`activity_logs`、`invitations`、`invitation_templates`、`coach_client_relationships`、`coach_clients`、`workout_plans`、`friend_requests`、`friendships`、`meals`、`workouts`、`progress_entries`。若需保留其中資料，請先備份並在 `server/scripts/align-uuid-fks.sql` 中註解對應的 `TRUNCATE`。

---

## 方式一：用 Node 腳本執行（推薦）

從專案根目錄執行（會自動使用 `server/.env.local` 的 `DATABASE_URL`）：

```bash
npx tsx server/scripts/run-align-uuid-fks.ts
```

成功後會印出「遷移完成」，接著執行 e2e。

---

## 方式二：用 psql 手動執行

1. 設定 `DATABASE_URL`（與後端相同）：

   ```bash
   export DATABASE_URL="postgresql://..."   # 或從 server/.env.local 複製
   ```

2. 執行 SQL 檔：

   ```bash
   psql "$DATABASE_URL" -f server/scripts/align-uuid-fks.sql
   ```

---

## 方式三：僅用 Drizzle（不建議單獨依賴）

目前 `db:push` 若偵測不到變更，可能是既有 DB 與 schema 已部分一致或 Drizzle 未正確比對。**建議先用手動 SQL 遷移（方式一或二）**，再視需要執行：

```bash
npm run db:push
```

以確認沒有遺漏的欄位或索引。

---

## 遷移完成後：跑 e2e

1. 啟動後端（若尚未啟動）：

   ```bash
   npm run dev:backend
   ```

2. 在另一終端執行 e2e：

   ```bash
   npx tsx server/scripts/e2e-test.ts
   ```

預期：**Test 6（POST /api/invitations）與 Test 8（GET /api/invitations 含邀請）** 不再出現 500 或 FK 錯誤，全部通過。

---

## 若仍有錯誤

- **`relation "xxx" does not exist`**：代表該表尚未建立，請先執行 `npm run db:push` 或套用既有 `drizzle/*.sql` 建立表。
- **`column "users"."id" must be varchar`** 或 FK 仍失敗：代表 `users.id` 仍是 integer，需先將 `users.id` 改為 `varchar` 並把既有 ID 遷移為 UUID 後，再執行本遷移。
- **`duplicate key value`**：多為 e2e 重跑時未清空資料，e2e 腳本會清 `users` / `invitations`；若你改過清空邏輯，請確認有清到相關表。

---

## 指令順序總覽

| 步驟 | 指令 | 說明 |
|------|------|------|
| 1 | （可選）備份 DB | 用 `pg_dump` 或既有備份腳本 |
| 2 | `npx tsx server/scripts/run-align-uuid-fks.ts` 或 `psql ... -f server/scripts/align-uuid-fks.sql` | 執行 UUID FK 遷移 |
| 3 | `npm run dev:backend` | 啟動後端 |
| 4 | `npx tsx server/scripts/e2e-test.ts` | 跑 e2e，確認 500/FK 已消失 |
