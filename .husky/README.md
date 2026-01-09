# Husky Git Hooks

此目錄包含項目的 Git hooks 配置。

## 文件說明

- `pre-commit`: 在提交前運行的檢查
- `_/husky.sh`: Husky 核心腳本

## 設置完成後的操作

安裝依賴後，運行以下命令來初始化 hooks：

```bash
npm install
```

`prepare` 腳本會自動運行 `husky install`，設置 Git hooks。

## 驗證設置

```bash
# 檢查 Git hooks 路徑是否正確
git config core.hooksPath

# 應該顯示: .husky
```

## 測試

創建一個測試提交來驗證 hooks 是否正常工作：

```bash
# 修改一個文件
echo "// test" >> test.ts

# 嘗試提交
git add test.ts
git commit -m "test: verify pre-commit hooks"

# 如果有類型錯誤，提交會被阻止
```

