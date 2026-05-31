# Pre-commit Hooks 設置說明

## 📋 概述

本項目已配置 Pre-commit Hooks，在每次 Git 提交前自動運行代碼檢查，確保代碼質量並防止類型錯誤進入版本控制。

## 🛠️ 使用的工具

- **Husky**: Git hooks 管理器，簡化 hooks 的設置和管理
- **lint-staged**: 只檢查已暫存（staged）的文件，提高效率

## ✅ 檢查內容

Pre-commit hook 會自動執行以下檢查：

1. **TypeScript 類型檢查**: 運行 `tsc --noEmit --skipLibCheck` 檢查所有 TypeScript 文件的類型錯誤
   - 使用 `--skipLibCheck` 跳過第三方庫的類型檢查，提高速度
   - 只檢查項目代碼中的類型錯誤

## 📦 安裝步驟

### 1. 安裝依賴

```bash
npm install
```

`prepare` 腳本會自動運行，初始化 Husky。

### 2. 驗證安裝

```bash
# 檢查 .husky/pre-commit 文件是否存在
ls -la .husky/pre-commit

# 應該顯示可執行權限
# -rwxr-xr-x  .husky/pre-commit
```

## 🚀 使用方式

### 正常使用

當你執行 `git commit` 時，hooks 會自動運行：

```bash
git add .
git commit -m "你的提交訊息"
```

如果檢查通過，提交會成功。如果有錯誤，提交會被阻止，你需要修復錯誤後再次提交。

### 跳過檢查（不推薦）

如果確實需要跳過檢查（例如緊急修復），可以使用 `--no-verify` 標誌：

```bash
git commit --no-verify -m "緊急修復"
```

⚠️ **警告**: 只有在緊急情況下才使用此選項，並且應該在事後補上檢查。

## 🔧 配置說明

### `.lintstagedrc.json`

配置 lint-staged 要執行的檢查：

```json
{
  "*.{ts,tsx}": [
    "bash -c 'tsc --noEmit'"
  ]
}
```

此配置會對所有 `.ts` 和 `.tsx` 文件運行 TypeScript 類型檢查。

### `.husky/pre-commit`

Pre-commit hook 腳本，在提交前執行：

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# 運行 lint-staged 檢查已暫存的文件
npx lint-staged
```

## 🐛 故障排除

### Hook 沒有運行

1. 確保 Husky 已初始化：
   ```bash
   npm run prepare
   ```

2. 檢查 Git hooks 路徑：
   ```bash
   git config core.hooksPath
   ```
   應該顯示 `.husky`

3. 檢查文件權限：
   ```bash
   chmod +x .husky/pre-commit
   ```

### TypeScript 檢查太慢

如果檢查太慢，可以考慮：
- 使用增量編譯：`tsc --noEmit --incremental`
- 只檢查特定目錄
- 使用 ESLint 進行更快的語法檢查

### 在 CI/CD 中的使用

Pre-commit hooks 不會在 CI/CD 中運行（它們只在本地運行）。建議在 CI/CD 中也運行相同的檢查：

```yaml
# .github/workflows/ci.yml 範例
- name: Type Check
  run: npm run check
```

## 📝 擴展功能

未來可以添加的檢查：

1. **ESLint**: 代碼風格和質量檢查
2. **Prettier**: 自動代碼格式化
3. **測試**: 運行單元測試
4. **提交訊息檢查**: 確保提交訊息符合規範（如 Conventional Commits）
5. **文件大小檢查**: 防止提交過大的文件
6. **敏感信息掃描**: 檢查是否意外提交密碼或 API 密鑰

## 🔗 相關資源

- [Husky 文檔](https://typicode.github.io/husky/)
- [lint-staged 文檔](https://github.com/okonet/lint-staged)
- [TypeScript 編譯選項](https://www.typescriptlang.org/tsconfig)

## 💡 最佳實踐

1. **經常提交**: 小步驟提交，讓 hooks 更快完成
2. **修復錯誤**: 不要跳過檢查，及時修復問題
3. **團隊協作**: 確保所有團隊成員都安裝了 hooks
4. **持續改進**: 根據項目需求調整檢查規則

---

**注意**: `.husky` 目錄應該提交到版本控制中，這樣所有團隊成員都會使用相同的 hooks 配置。

