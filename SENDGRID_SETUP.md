# SendGrid 郵件服務配置指南

本文檔說明如何配置 SendGrid 郵件服務以啟用 FitBuddy 的郵件發送功能。

## 📋 前置要求

1. 已安裝 `@sendgrid/mail` 套件（已在 `package.json` 中）
2. 擁有 SendGrid 帳戶（免費版即可）

## 🔑 獲取 SendGrid API Key

1. 登入 [SendGrid](https://sendgrid.com/)
2. 前往 **Settings** → **API Keys**
3. 點擊 **Create API Key**
4. 選擇 **Full Access** 或 **Restricted Access**（建議選擇 **Mail Send** 權限）
5. 複製生成的 API Key（只會顯示一次，請妥善保存）

## ⚙️ 環境變量配置

在 `.env` 文件中添加以下環境變量：

```env
# SendGrid 配置
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@fitbuddy.hk
SENDGRID_SUPPORT_EMAIL=support@fitbuddy.hk

# 客戶端 URL（用於生成邀請鏈接）
CLIENT_URL=http://localhost:5173
# 或生產環境
# CLIENT_URL=https://yourdomain.com
```

### 環境變量說明

- **SENDGRID_API_KEY**（必填）
  - SendGrid API Key，用於認證
  - 格式：`SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

- **SENDGRID_FROM_EMAIL**（可選，默認：`noreply@fitbuddy.hk`）
  - 發件人郵箱地址
  - 必須在 SendGrid 中驗證此域名或郵箱
  - 建議使用已驗證的發件人地址

- **SENDGRID_SUPPORT_EMAIL**（可選，默認：`support@fitbuddy.hk`）
  - 支持郵箱地址，用於郵件回覆
  - 建議使用已驗證的郵箱

- **CLIENT_URL**（可選，默認：`http://localhost:5173`）
  - 客戶端應用 URL
  - 用於生成邀請鏈接
  - 生產環境應設置為實際域名

## 📧 驗證發件人身份

在 SendGrid 中驗證你的發件人郵箱或域名：

1. 前往 **Settings** → **Sender Authentication**
2. 選擇 **Single Sender Verification** 或 **Domain Authentication**
3. 按照指示完成驗證流程

**注意：** 未驗證的發件人可能導致郵件被標記為垃圾郵件或被拒絕。

## 🧪 測試郵件發送

### 開發環境

在開發環境中，如果未設置 `SENDGRID_API_KEY`，系統會記錄警告但不會拋出錯誤，邀請記錄仍會創建。

### 生產環境

確保所有環境變量都已正確設置，然後測試發送邀請郵件：

```bash
# 檢查環境變量是否設置
echo $SENDGRID_API_KEY
```

## 📝 使用方式

### 在代碼中使用

```typescript
import { EmailService } from './services/emailService';

const emailService = new EmailService();

// 發送邀請郵件
await emailService.sendInvitationEmail(
  'client@example.com',
  '客戶名稱',
  '教練名稱',
  'invitation-token-123',
  'https://example.com/coach-profile' // 可選
);

// 發送自定義郵件
await emailService.sendEmail({
  to: 'user@example.com',
  subject: '主題',
  html: '<h1>郵件內容</h1>',
});
```

### 現有代碼兼容性

現有的 `invitationService.ts` 已自動使用新的 SendGrid 服務，無需修改代碼。

## 🔍 故障排除

### 郵件發送失敗

1. **檢查 API Key**
   ```bash
   # 確認環境變量已設置
   echo $SENDGRID_API_KEY
   ```

2. **檢查發件人驗證**
   - 確認 `SENDGRID_FROM_EMAIL` 已在 SendGrid 中驗證

3. **查看日誌**
   - 檢查服務器日誌中的錯誤訊息
   - SendGrid 錯誤通常包含詳細的錯誤原因

### 常見錯誤

- **`SENDGRID_API_KEY 未設置`**
  - 解決：在 `.env` 文件中添加 `SENDGRID_API_KEY`

- **`The from address does not match a verified Sender Identity`**
  - 解決：在 SendGrid 中驗證發件人郵箱或域名

- **`Forbidden`**
  - 解決：檢查 API Key 是否有效，是否有足夠的權限

## 📚 相關資源

- [SendGrid 官方文檔](https://docs.sendgrid.com/)
- [SendGrid Node.js SDK](https://github.com/sendgrid/sendgrid-nodejs)
- [SendGrid API 參考](https://docs.sendgrid.com/api-reference)

## 🔒 安全建議

1. **不要將 API Key 提交到版本控制系統**
   - 確保 `.env` 文件在 `.gitignore` 中

2. **使用環境變量**
   - 在生產環境中使用環境變量而非硬編碼

3. **限制 API Key 權限**
   - 在 SendGrid 中創建具有最小必要權限的 API Key

4. **定期輪換 API Key**
   - 定期更新 API Key 以提高安全性


