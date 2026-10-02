#!/usr/bin/env bash
# ==========================================================
#  Sao lưu tự động: MySQL + Redis + mã nguồn + cấu hình
#  -> nén -> MÃ HÓA AES-256 -> lưu cục bộ -> đồng bộ ra ngoài -> dọn bản cũ
#  Cron chạy mỗi ngày (xem setup-backup.sh). Chạy tay: bash ops/backup/backup.sh
# ==========================================================
set -euo pipefail
source "$(dirname "$0")/../common.sh"
CONF="$HOME/.backup.env"
[ -f "$CONF" ] || { red "Chưa có $CONF – chạy setup-backup.sh trước"; exit 1; }
source "$CONF"     # BACKUP_DIR, RETENTION_DAYS, PASSFILE, RCLONE_REMOTE, TG_UPLOAD

STAMP=$(date +%F_%H%M)
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
mkdir -p "$BACKUP_DIR"
START=$(date +%s)
echo "[$(date '+%F %T')] ===== BACKUP $STAMP ====="

# 1) MySQL (nhất quán, không khóa bảng)
DB_HOST=$(getenv DB_HOST "$ENV_FILE"); DB_PORT=$(getenv DB_PORT "$ENV_FILE")
DB_USER=$(getenv DB_USERNAME "$ENV_FILE"); DB_NAME=$(getenv DB_NAME "$ENV_FILE")
MYSQL_PWD=$(getenv DB_PASSWORD "$ENV_FILE") mysqldump -h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "$DB_USER" \
  --single-transaction --quick --routines --triggers --no-tablespaces "$DB_NAME" | gzip -9 > "$WORK/mysql-$DB_NAME.sql.gz"
echo "  ✓ MySQL: $(du -h "$WORK/mysql-$DB_NAME.sql.gz" | cut -f1)"

# 2) Redis snapshot
if [ -f "$HOME/.redis_admin" ] && command -v redis-cli >/dev/null; then
  source "$HOME/.redis_admin"
  redis-cli --no-auth-warning -a "$REDIS_ADMIN_PASS" --rdb "$WORK/redis.rdb" >/dev/null 2>&1 \
    && gzip -9 "$WORK/redis.rdb" && echo "  ✓ Redis: $(du -h "$WORK/redis.rdb.gz" | cut -f1)" || echo "  ⚠ Bỏ qua Redis"
fi

# 3) Mã nguồn + cấu hình (.env, bot, web tĩnh, pm2) – bỏ node_modules/.next
tar -czf "$WORK/files.tar.gz" \
  --exclude=node_modules --exclude='.next*' --exclude=.git \
  -C "$HOME" apps \
  -C / opt/tgbot \
  -C "$HOME" .pm2/dump.pm2 2>/dev/null || true
echo "  ✓ Files: $(du -h "$WORK/files.tar.gz" | cut -f1)"

# 4) Gộp + mã hóa AES-256 (PBKDF2 200k vòng)
OUT="$BACKUP_DIR/studynotion-$STAMP.tar.enc"
tar -cf - -C "$WORK" . | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass "file:$PASSFILE" -out "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
chmod 600 "$OUT" "$OUT.sha256"
SIZE=$(du -h "$OUT" | cut -f1)
echo "  ✓ Mã hóa: $OUT ($SIZE)"

# 5) Đồng bộ ra ngoài VPS
SYNC="chỉ lưu cục bộ"
if [ -n "${RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null; then
  rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "studynotion-*" --max-age 2d \
    && rclone delete "$RCLONE_REMOTE" --min-age "${RETENTION_DAYS}d" \
    && SYNC="rclone → $RCLONE_REMOTE"
fi
if [ "${TG_UPLOAD:-yes}" = "yes" ]; then
  BYTES=$(stat -c %s "$OUT")
  TOKEN=$(getenv BOT_TOKEN "$BOT_ENV"); CHAT=$(getenv ADMIN_CHAT_ID "$BOT_ENV" | cut -d, -f1)
  if [ "$BYTES" -lt 49000000 ] && [ -n "$TOKEN" ]; then
    curl -s -m 300 -F chat_id="$CHAT" -F document=@"$OUT" \
      -F caption="🔐 Backup $STAMP ($SIZE) – mã hóa AES-256" \
      "https://api.telegram.org/bot$TOKEN/sendDocument" | grep -q '"ok":true' \
      && SYNC="$SYNC + Telegram"
  fi
fi
echo "  ✓ Đồng bộ: $SYNC"

# 6) Dọn bản cũ hơn RETENTION_DAYS ngày
DELETED=$(find "$BACKUP_DIR" -name 'studynotion-*' -type f -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
COUNT=$(ls "$BACKUP_DIR"/studynotion-*.tar.enc 2>/dev/null | wc -l)
echo "  ✓ Dọn dẹp: xóa $DELETED file cũ, còn $COUNT bản"

DUR=$(( $(date +%s) - START ))
tg_notify "💾 <b>Backup thành công</b> $STAMP
📦 $SIZE (AES-256) • ${DUR}s
☁️ $SYNC
🗂 Còn $COUNT bản (giữ ${RETENTION_DAYS} ngày)"
echo "[$(date '+%F %T')] ===== XONG (${DUR}s) ====="
