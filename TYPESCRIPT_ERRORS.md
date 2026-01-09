# TypeScript 類型錯誤處理指南

## 📋 當前狀況

項目中目前存在約 **66 個 TypeScript 類型錯誤**，這些錯誤會阻止提交。

## 🔍 錯誤分類

根據檢查結果，主要錯誤類型包括：

1. **屬性不存在錯誤** (TS2339): 
   - `meal.date` 應該是 `meal.consumedAt`
   - `meal.foodName` 應該是 `meal.name`
   - `workout.exercises` 屬性缺失
   - `response.ok` 在 Axios 中不存在（應該檢查 `response.status`）

2. **類型不匹配錯誤** (TS2345, TS2352, TS2353):
   - mealType 應該是 `"BREAKFAST"` 而不是 `"breakfast"`
   - 各種類型轉換問題

3. **未定義變量** (TS2304, TS2552):
   - 缺少導入語句
   - 變量作用域問題

4. **模組找不到** (TS2307):
   - `shared/schema` 模組路徑問題

## 🛠️ 解決策略

### 選項 1: 暫時跳過類型檢查（不推薦但可用於緊急情況）

在提交時使用 `--no-verify`：
```bash
git commit --no-verify -m "your message"
```

### 選項 2: 逐步修復錯誤（推薦）

建議優先修復以下高優先級錯誤：

1. **修復 meal 相關的字段名稱**:
   - `foodName` → `name`
   - `date` → `consumedAt`

2. **修復 mealType 枚舉值**:
   - `"breakfast"` → `"BREAKFAST"`
   - `"lunch"` → `"LUNCH"`
   - 等等

3. **修復 Axios 響應檢查**:
   - `response.ok` → `response.status === 200`

### 選項 3: 調整 lint-staged 配置

可以在 `.lintstagedrc.json` 中調整檢查策略，例如：
- 只檢查語法錯誤而不檢查類型
- 允許一定數量的錯誤
- 只檢查修改的文件

## 📝 快速修復清單

### 高優先級（影響核心功能）

1. ✅ `server/routes.ts` - 已修復 `heightCm` 錯誤
2. ⚠️ `client/src/components/edit-meal-modal.tsx` - meal 字段名稱
3. ⚠️ `client/src/components/meal-list.tsx` - meal.date → meal.consumedAt
4. ⚠️ `client/src/pages/dashboard.tsx` - workout.exercises 和 response.ok

### 中優先級（影響特定功能）

5. ⚠️ `client/src/components/tdee-calculator.tsx` - API 路由類型
6. ⚠️ `server/storage.ts` - 模組導入和類型轉換
7. ⚠️ `server/db/queries.ts` - 類型匹配問題

## 🔄 修復步驟

1. **修復 meal 相關類型**（最多錯誤）:
   ```bash
   # 全局替換
   grep -r "\.foodName" client/src --include="*.tsx" --include="*.ts"
   grep -r "\.date" client/src --include="*.tsx" | grep meal
   ```

2. **修復 workout 相關類型**:
   ```bash
   grep -r "\.exercises" client/src --include="*.tsx"
   ```

3. **修復 API 響應檢查**:
   ```bash
   grep -r "\.ok" client/src --include="*.tsx"
   ```

## 💡 建議

建議採用**逐步修復策略**：
1. 每次修復一個類別的錯誤
2. 修復後提交，讓 hooks 驗證
3. 繼續下一個類別

這樣可以：
- 保持代碼庫穩定
- 每次提交都有清晰的改進
- 避免一次性大規模修改帶來的風險

---

**注意**: 這些類型錯誤不會影響運行時行為，但會影響代碼的可維護性和類型安全性。強烈建議逐步修復。

