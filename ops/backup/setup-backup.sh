#!/usr/bin/env bash
# ==========================================================
#  Cài lịch sao lưu tự động bằng cron (mặc định 02:30 mỗi ngày)
#  Chạy:  bash ops/backup/setup-backup.sh
# ==========================================================
set -euo pipefail
source "$(dirname "$0")/../common.sh"
DIR="$(cd "$(dirname "$0")" && pwd)"
umask 077

if [ ! -f "$HOME/.backup_pass" ]; then
  openssl rand -base64 48 > "$HOME/.backup_pass"
  yellow "Đã tạo khóa mã hóa ~/.backup_pass – HÃY LƯU KHÓA NÀY RA NƠI KHÁC (mất khóa = không giải mã được):"
  cat "$HOME/.backup_pass"
fi
[ -f "$HOME/.backup.env" ] || cat > "$HOME/.backup.env" <<CFG
BACKUP_DIR=$HOME/backups/auto
RETENTION_DAYS=7
PASSFILE=$HOME/.backup_pass
# Đồng bộ ra cloud bằng rclone (tuỳ chọn), VD: gdrive:studynotion-backup
RCLONE_REMOTE=
# Gửi file backup mã hóa về Telegram admin (nếu < 49MB)
TG_UPLOAD=yes
CFG
chmod 600 "$HOME/.backup.env" "$HOME/.backup_pass"
mkdir -p "$HOME/logs" "$HOME/backups/auto"
chmod +x "$DIR"/*.sh

CRON="30 2 * * * bash $DIR/backup.sh >> $HOME/logs/backup.log 2>&1"
( { crontab -l 2>/dev/null || true; } | { grep -v "ops/backup/backup.sh" || true; }; echo "$CRON" ) | crontab -
green "✓ Đã đặt lịch cron:"; crontab -l | grep backup

green "Chạy thử 1 lần ngay bây giờ..."
bash "$DIR/backup.sh"
