-- 創建 email_logs 表
-- 用於記錄所有發送的郵件，包括邀請郵件和驗證郵件

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id INTEGER,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 創建索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_email_logs_coach_id ON email_logs(coach_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_message_id ON email_logs(message_id);

-- 添加外鍵約束（如果 coach_id 對應的 users 表存在）
-- 注意：如果 users 表的 id 是 integer 類型，則啟用此約束
-- ALTER TABLE email_logs 
--   ADD CONSTRAINT fk_email_logs_coach_id 
--   FOREIGN KEY (coach_id) 
--   REFERENCES users(id) 
--   ON DELETE SET NULL;

-- 添加註釋
COMMENT ON TABLE email_logs IS '記錄所有發送的郵件，包括邀請郵件和驗證郵件';
COMMENT ON COLUMN email_logs.id IS '唯一標識符';
COMMENT ON COLUMN email_logs.coach_id IS '發送者（教練）ID，可選';
COMMENT ON COLUMN email_logs.recipient_email IS '收件人郵箱地址';
COMMENT ON COLUMN email_logs.subject IS '郵件主題';
COMMENT ON COLUMN email_logs.message_id IS 'SendGrid 返回的 message ID';
COMMENT ON COLUMN email_logs.status IS '郵件狀態：sent, failed, bounced, delivered 等';
COMMENT ON COLUMN email_logs.error_message IS '如果發送失敗，存放錯誤信息';
COMMENT ON COLUMN email_logs.sent_at IS '郵件發送時間';
COMMENT ON COLUMN email_logs.created_at IS '記錄建立時間';

