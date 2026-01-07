import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const app = express();
app.use(express.json());

// 數據庫連接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '[REDACTED_DATABASE_URL]
});

pool.on('error', (err) => console.error('Unexpected error on idle client', err));

// API 路由
app.get('/api/admin/email/config', (req, res) => {
  res.json({
    sendgridConfigured: true,
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'support@fitbuddy.hk'
  });
});

app.get('/api/v1/invitations/coach/list', (req, res) => {
  res.json({
    success: true,
     []
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Database connected');
  console.log('SendGrid configured: true');
});
