#!/bin/bash

# FitBuddy 資料庫備份腳本
# 使用方法: ./backup-db.sh

set -e  # 遇到錯誤立即退出

# 獲取腳本所在目錄
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 查找並加載 DATABASE_URL
ENV_FILE=""
if [ -f "server/.env.local" ]; then
  ENV_FILE="server/.env.local"
elif [ -f ".env" ]; then
  ENV_FILE=".env"
else
  echo "❌ 錯誤: 找不到環境變量文件 (server/.env.local 或 .env)"
  exit 1
fi

echo "📁 使用環境變量文件: $ENV_FILE"

# 讀取 DATABASE_URL
DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')

if [ -z "$DATABASE_URL" ]; then
  echo "❌ 錯誤: 在 $ENV_FILE 中找不到 DATABASE_URL"
  exit 1
fi

# 驗證 DATABASE_URL 格式
if [[ ! "$DATABASE_URL" =~ ^postgres ]]; then
  echo "⚠️  警告: DATABASE_URL 格式可能不正確"
  echo "   當前值: ${DATABASE_URL:0:50}..."
fi

# 生成備份文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="fitbuddy_backup_${TIMESTAMP}.sql"
BACKUP_DIR="backups"

# 創建備份目錄（如果不存在）
mkdir -p "$BACKUP_DIR"

BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"

echo "📦 開始備份資料庫..."
echo "   目標文件: $BACKUP_PATH"

# 執行備份
if pg_dump "$DATABASE_URL" > "$BACKUP_PATH" 2>&1; then
  BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
  echo "✅ 備份成功完成！"
  echo "   文件: $BACKUP_PATH"
  echo "   大小: $BACKUP_SIZE"
  
  # 顯示最近的備份文件
  echo ""
  echo "📋 最近的備份文件:"
  ls -lht "$BACKUP_DIR"/*.sql 2>/dev/null | head -5 || echo "   無備份文件"
else
  echo "❌ 備份失敗！"
  echo ""
  echo "💡 可能的問題："
  echo "   1. DATABASE_URL 不正確"
  echo "   2. 資料庫服務器無法連接"
  echo "   3. pg_dump 未安裝"
  echo "   4. 沒有資料庫訪問權限"
  echo ""
  echo "🔍 測試連接:"
  echo "   psql \"\$DATABASE_URL\" -c \"SELECT version();\""
  exit 1
fi

