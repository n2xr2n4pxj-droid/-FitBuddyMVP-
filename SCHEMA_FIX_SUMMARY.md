# Schema 修復總結

## 問題
`users.email_verification_expires` 欄位類型不匹配：
- **數據庫實際類型**：`bigint`
- **Schema 文件定義**：`integer`

## 修復
已更新 `server/db/schema.ts`：
1. 導入 `bigint` 類型
2. 將 `emailVerificationExpires` 從 `integer` 改為 `bigint`，並使用 `{ mode: 'number' }`

## 修改內容

### 1. 導入 bigint
```typescript
import { 
  // ... 其他導入
  bigint,  // 新增
  // ...
} from 'drizzle-orm/pg-core';
```

### 2. 更新欄位定義
```typescript
// 修改前
emailVerificationExpires: integer('email_verification_expires'),

// 修改後
emailVerificationExpires: bigint('email_verification_expires', { mode: 'number' }),
```

## 下一步
執行 `npm run db:push` 驗證修復是否成功。

