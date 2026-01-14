# FitBuddy 設計系統

## 顏色系統

### 背景
- **主背景**: `bg-slate-950` (深色 #0f172a)
- **次要背景**: `bg-slate-900/50` (半透明深色)
- **卡片背景**: `bg-slate-800/50` (深色卡片)

### 按鈕顏色
- **主按鈕背景**: `bg-emerald-500` (青綠 #10b981)
- **主按鈕懸停**: `bg-emerald-600`
- **次要按鈕**: `bg-transparent` + `border-2 border-white/20`
- **次要按鈕懸停**: `hover:bg-white/5`

### 文字顏色
- **主文字**: `text-white`
- **次要文字**: `text-white/70` 或 `text-gray-400`
- **標籤文字**: `text-white/80`

### 邊框顏色
- **默認邊框**: `border-slate-700`
- **焦點邊框**: `border-emerald-500`
- **錯誤邊框**: `border-red-500`

### 狀態顏色
- **錯誤**: `text-red-500` 或 `text-red-400`
- **成功**: `text-emerald-500` 或 `text-emerald-400`
- **警告**: `text-yellow-500` 或 `text-yellow-400`

## 間距系統

### 頁面間距
- **頁面頂部**: `pt-40` (10rem / 160px)
- **頁面底部**: `pb-32` (8rem / 128px)
- **頁面側邊**: `px-4` (1rem / 16px)

### 組件間距
- **小間距**: `gap-2` (0.5rem / 8px)
- **中等間距**: `gap-4` (1rem / 16px)
- **大間距**: `gap-6` (1.5rem / 24px)

### 輸入框間距
- **水平內邊距**: `px-4` (1rem / 16px)
- **垂直內邊距**: `py-2` (0.5rem / 8px)

### 按鈕間距
- **水平內邊距**: `px-4` 或 `px-6` (1rem / 16px 或 1.5rem / 24px)
- **垂直內邊距**: `py-3` 或 `py-6` (0.75rem / 12px 或 1.5rem / 24px)

## 排版系統

### 標題
- **主標題 (h1)**: `text-3xl font-bold` (1.875rem / 30px, 粗體)
- **副標題 (h2)**: `text-2xl font-bold` (1.5rem / 24px, 粗體)
- **小標題 (h3)**: `text-xl font-semibold` (1.25rem / 20px, 半粗體)

### 正文
- **正文**: `text-base` (1rem / 16px)
- **小正文**: `text-sm` (0.875rem / 14px)
- **超小正文**: `text-xs` (0.75rem / 12px)

### 標籤
- **標籤文字**: `text-sm font-medium` (0.875rem / 14px, 中等粗細)

### 副標題/描述
- **副標題**: `text-lg text-gray-400` (1.125rem / 18px, 灰色)
- **描述文字**: `text-white/70` 或 `text-gray-400`

## 使用示例

### 頁面容器
```tsx
<div className="min-h-screen bg-slate-950 text-white pt-40 pb-32 px-4">
  {/* 內容 */}
</div>
```

### 主按鈕
```tsx
<Button className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3">
  按鈕文字
</Button>
```

### 次要按鈕
```tsx
<Button className="bg-transparent border-2 border-white/20 hover:bg-white/5 text-white px-4 py-3">
  按鈕文字
</Button>
```

### 輸入框
```tsx
<Input className="bg-slate-900/50 border-slate-700 text-white px-4 py-2" />
```

### 標題區域
```tsx
<div className="text-center space-y-2">
  <h2 className="text-3xl font-bold text-white">標題</h2>
  <p className="text-lg text-gray-400">副標題</p>
</div>
```
