#!/bin/bash
# 滑雪俱乐部网站自动备份脚本
# 每30分钟执行，保留最近2个备份

PROJECT_DIR="/Users/macos13/.openclaw/workspace/projects/ski-club-website"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# 创建备份
tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" \
  -C "$PROJECT_DIR" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='backups' \
  admin-booking.html booking.html my.html server.js db.js db-turso.js \
  admin.html index.html courses.html lottery.html \
  css js data migrations 2>/dev/null

# 获取所有备份（按时间排序，最旧的在前）
BACKUPS=$(ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null)

# 如果有超过2个备份，删除多余的
if [ -n "$BACKUPS" ]; then
  COUNT=$(echo "$BACKUPS" | wc -l)
  if [ "$COUNT" -gt 2 ]; then
    echo "$BACKUPS" | tail -n +3 | xargs rm -f 2>/dev/null
    echo "备份完成，删除了 $((COUNT - 2)) 个旧备份"
  else
    echo "备份完成，共 $COUNT 个备份"
  fi
fi

echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
