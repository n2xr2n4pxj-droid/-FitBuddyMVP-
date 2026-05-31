# Open Food Facts 集成診斷報告

## 📋 診斷結果

### 1. Server 結構分析

**主應用文件**: `server/index.ts`
- Express 應用入口點
- 通過 `registerRoutes(app)` 註冊所有路由
- 監聽端口: `process.env.PORT || 3000`

**路由註冊文件**: `server/routes.ts`
- `registerRoutes()` 函數負責註冊所有 API 路由
- 現有路由模式: `app.use("/api", routeModule)`

**現有路由目錄**: `server/routes/`
- `auth.ts`
- `coaches.ts`
- `workouts.ts`
- `workout-plans.ts`
- `invitations.ts`
- `emailAdminRoutes.ts`

### 2. Food.ts 狀態檢查

**文件位置**: `server/src/routes/food.ts` ❌ **位置不正確**
- 應該在 `server/routes/food.ts` 以保持一致性

**當前狀態**: 
- ✅ 已實現 Open Food Facts API 集成
- ✅ 包含 `searchFoods()` 函數
- ✅ 包含 Express 路由 `/search`
- ❌ **未在主應用中註冊**
- ❌ **未在 routes.ts 中導入**

**現有衝突**:
- 現有 USDA API 路由: `/api/nutrition/search/:query` (在 `routes.ts` 中)
- 新 Open Food Facts 路由: `/search` (在 `food.ts` 中，但未註冊)

### 3. 響應格式差異

**USDA API** (`/api/nutrition/search/:query`):
```json
[
  {
    "fdcId": "...",
    "description": "...",
    "calories": 100,
    "protein": 10,
    "carbs": 20,
    "fat": 5
  }
]
```

**Open Food Facts** (`food.ts`):
```json
{
  "foods": [
    {
      "name": "...",
      "calories": 100,
      "protein": 10,
      "carbs": 20,
      "fats": 5,
      "fdc_id": "..."
    }
  ]
}
```

⚠️ **注意**: 字段名稱不一致 (`fat` vs `fats`, `description` vs `name`)

## 🔧 集成方案

### 步驟 1: 移動並統一文件位置

將 `server/src/routes/food.ts` 移動到 `server/routes/food.ts`

### 步驟 2: 統一響應格式

修改 `food.ts` 以匹配現有的 USDA API 響應格式，確保前端兼容性

### 步驟 3: 註冊路由

在 `server/routes.ts` 中導入並註冊 food 路由

### 步驟 4: 選擇路由路徑

建議使用 `/api/food/search` 作為 Open Food Facts 端點，與 USDA 的 `/api/nutrition/search/:query` 區分

## 📝 需要修改的文件

1. ✅ `server/src/routes/food.ts` → 移動到 `server/routes/food.ts`
2. ✅ `server/routes/food.ts` → 修改響應格式和字段名稱
3. ✅ `server/routes.ts` → 添加路由註冊

## 🎯 實施計劃

見下方具體代碼修改

