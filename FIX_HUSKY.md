# Husky 配置修復說明

## ⚠️ 問題

Husky v9+ 已棄用舊的 hook 語法。Pre-commit hook 不應包含以下兩行：

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
```

這些行將在 Husky v10.0.0 中失效。

## ✅ 解決方案

已將 `.husky/pre-commit` 簡化為：

```sh
npx lint-staged
```

Husky v9+ 會自動處理 hook 的執行，不需要手動引入腳本。

## 🔧 驗證

執行以下命令驗證配置：

```bash
# 檢查 hooks 路徑
git config core.hooksPath
# 應該顯示: .husky

# 檢查 pre-commit 文件
cat .husky/pre-commit
# 應該只包含: npx lint-staged

# 測試 hook（嘗試提交）
git add .
git commit -m "test: verify husky hooks"
```

## 📝 注意事項

1. 如果仍有類型錯誤，提交會被阻止（這是預期行為）
2. 可以使用 `git commit --no-verify` 跳過檢查（僅在緊急情況下）
3. 建議逐步修復 TypeScript 錯誤（參考 `TYPESCRIPT_ERRORS.md`）

