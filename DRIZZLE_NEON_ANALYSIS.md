# Drizzle Schema 與 Neon PostgreSQL 不匹配分析

## 第一步：Neon 現狀（查詢結果）

| table_name | column_name | data_type | is_identity | column_default | constraint_type |
|------------|-------------|-----------|-------------|---------------|------------------|
| activity_logs | id | character varying | NO | gen_random_uuid() | PRIMARY KEY |
| activity_logs | user_id | integer | NO | null | null |
| coach_client_relationships | client_id | integer | NO | null | null |
| coach_client_relationships | coach_id | integer | NO | null | null |
| coach_client_relationships | id | character varying | NO | gen_random_uuid() | PRIMARY KEY |
| coach_clients | client_id | integer | NO | null | null |
| coach_clients | coach_id | integer | NO | null | null |
| coach_clients | id | character varying | NO | gen_random_uuid() | PRIMARY KEY |
| email_logs | coach_id | integer | NO | null | null |
| email_logs | id | character varying | NO | null | PRIMARY KEY |
| friend_requests | id | character varying | NO | gen_random_uuid() | PRIMARY KEY |
| friendships | id | character varying | NO | gen_random_uuid() | PRIMARY KEY |
| invitation_templates | coach_id | integer | NO | null | null |
| invitation_templates | id | text | NO | null | PRIMARY KEY |
| invitations | id | character varying | NO | gen_random_uuid() | PRIMARY KEY |
| meals | id | character varying | NO | gen_random_uuid() | PRIMARY KEY |
| meals | user_id | integer | NO | null | null |
| progress_entries | id | character varying | NO | gen_random_uuid() | PRIMARY KEY |
| progress_entries | user_id | integer | NO | null | null |
| **users** | **id** | **character varying** | NO | **gen_random_uuid()** | PRIMARY KEY |
| workout_plans | client_id | integer | NO | null | null |
| workout_plans | coach_id | integer | NO | null | null |
| workout_plans | id | character varying | NO | gen_random_uuid() | PRIMARY KEY |
| workouts | id | character varying | NO | gen_random_uuid() | PRIMARY KEY |
| workouts | user_id | integer | NO | null | null |

要點：
- **users.id 在 Neon 是 `character varying`，default `gen_random_uuid()`**（非 integer/serial）。
- 其餘表的 `id` 多為 `character varying` + `gen_random_uuid()`；invitation_templates.id 為 `text`、無 default。
- 所有 `user_id`、`coach_id`、`client_id` 在 Neon 已為 **integer**。

---

## 第二步：Drizzle Schema 摘要

| 表名 | 主鍵定義 | 其他 id 欄位 |
|------|----------|--------------|
| users | **serial('id').primaryKey()** | - |
| invitations | varchar('id').primaryKey().default(sql\`gen_random_uuid()\`) | sender_id, receiver_id: integer |
| invitation_templates | text('id').primaryKey().$defaultFn(() => randomUUID()) | coach_id: integer |
| coach_client_relationships | varchar('id').primaryKey().default(sql\`gen_random_uuid()\`) | coach_id, client_id: integer |
| meals | varchar('id').primaryKey().default(sql\`gen_random_uuid()\`) | user_id: integer |
| workouts | varchar('id').primaryKey().default(sql\`gen_random_uuid()\`) | user_id: integer |
| progress_entries | varchar('id').primaryKey().default(sql\`gen_random_uuid()\`) | user_id: integer |
| activity_logs | varchar('id').primaryKey().default(sql\`gen_random_uuid()\`) | user_id: integer |
| friend_requests | varchar('id').primaryKey().default(sql\`gen_random_uuid()\`) | sender_id, receiver_id: integer |
| friendships | varchar('id').primaryKey().default(sql\`gen_random_uuid()\`) | user1_id, user2_id: integer |
| coach_clients | varchar('id').primaryKey().default(sql\`gen_random_uuid()\`) | coach_id, client_id: integer |
| workout_plans | varchar('id').primaryKey().default(sql\`gen_random_uuid()\`) | coach_id, client_id: integer |
| email_logs | varchar('id').primaryKey().notNull() | coach_id: integer |

---

## 第三步：不匹配對比

| 項目 | Neon 實際 | Drizzle 目前 | 是否一致 |
|------|-----------|--------------|----------|
| **users.id** | character varying, default gen_random_uuid() | **serial('id')** → 會生成 integer + nextval | **否** |
| 其他表 id | varchar + gen_random_uuid() 或 text | varchar/text + gen_random_uuid | 是 |
| *_id 欄位 | integer | integer | 是 |

唯一關鍵不匹配：**users 表的主鍵**。Neon 為 UUID (varchar)，Drizzle 為 serial (integer)，導致 db:push 時出現 "type serial does not exist" 或類似型別/預設值衝突。

---

## 第四步：建議修改

讓 **users.id** 與 Neon 一致，改為 **varchar + gen_random_uuid()**：

- **改前**：`id: serial('id').primaryKey(),`
- **改後**：`id: varchar('id').primaryKey().default(sql\`gen_random_uuid()\`),`

注意：Neon 上 `user_id` / `coach_id` / `client_id` 已是 **integer**，而 `users.id` 是 **varchar**。Schema 已將這些 FK 欄位改回 **integer** 以與 Neon 一致，避免 db:push 與寫入時的型別錯誤。目前未在 schema 中建立 FK constraint（integer 無法 reference varchar），僅邏輯上對應。

---

## 第五步：執行修改

在 `server/db/schema.ts` 中將 users 的 id 改為上述定義。
