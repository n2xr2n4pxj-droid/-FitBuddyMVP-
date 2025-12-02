# Prisma Schema 參考文件

## ⚠️ 重要說明

**此項目使用 Drizzle ORM，不使用 Prisma。**

此資料夾中的檔案僅作為數據庫設計參考，不會被實際使用。

---

## 📂 文件說明

- **`schema.prisma`**  
  原始 Prisma Schema 設計，保留作為數據庫架構文檔參考

---

## 🗄️ 實際數據庫配置

### 當前使用的 ORM

- **Drizzle ORM** + **PostgreSQL (Neon)**

### Schema 定義位置

- **實際 Schema**: `shared/schema.ts`
- **數據庫配置**: `drizzle.config.ts`
- **數據庫連接**: `server/db.ts`

### 數據庫遷移

使用 Drizzle Kit 進行數據庫遷移：

```bash
npm run db:push
```

---

## 📋 Prisma Schema 用途

此 Prisma schema 文件 (`schema.prisma`) 包含完整的數據庫設計，包括：

1. **用戶與角色系統**
   - USER、COACH、BOTH、ADMIN 角色
   - TDEE 計算相關字段
   - 個人資料管理

2. **邀請系統**
   - 教練邀請客戶
   - 客戶邀請教練
   - 邀請碼和狀態管理

3. **教練-客戶關聯**
   - 關係管理
   - 權限控制
   - 教練備註功能

4. **飲食追蹤**
   - 餐食記錄
   - 營養數據
   - 份量管理

5. **訓練追蹤**
   - 訓練記錄
   - 運動項目詳情
   - 強度和類型分類

6. **進度追蹤**
   - 身體數據記錄
   - 身體圍度測量
   - 照片存儲

7. **活動日誌**
   - 用戶活動記錄
   - 教練查看客戶活動

8. **朋友系統** (Phase 3)
   - 好友請求
   - 好友關係管理

---

## 🔄 未來遷移（可選）

如果未來需要從 Drizzle 遷移到 Prisma，可以：

1. 安裝 Prisma：
   ```bash
   npm install prisma @prisma/client
   ```

2. 生成 Prisma Client：
   ```bash
   npx prisma generate
   ```

3. 創建遷移：
   ```bash
   npx prisma migrate dev --name init
   ```

4. 更新代碼以使用 Prisma Client 替代 Drizzle

---

## 📝 注意事項

- 此 Prisma schema 僅作為設計文檔和參考
- 實際的數據庫結構由 `shared/schema.ts` 定義
- 不要運行 Prisma 遷移命令，除非計劃遷移到 Prisma

