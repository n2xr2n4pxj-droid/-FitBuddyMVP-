# 安全性說明

## 環境變量與憑證

- **切勿將 `server/.env.local` 或 `client/.env.local` 提交到版本控制。** 這些檔案已在 `.gitignore` 中排除。
- 若上述檔案曾不慎被提交，請**立即輪換所有憑證**（資料庫密碼、JWT 密鑰、SendGrid API Key、Google OAuth 憑證等），並使用 `git filter-repo` 或 BFG Repo-Cleaner 從歷史記錄中移除該檔案。
- 使用 `.env.example` 作為範本，在本地複製為 `.env.local` 並填入實際值。
