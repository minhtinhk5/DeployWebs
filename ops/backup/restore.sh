#!/usr/bin/env bash
# Giải mã & giải nén 1 bản backup để khôi phục
# Dùng:  bash ops/backup/restore.sh ~/backups/studynotion-2026-10-02_0230.tar.enc
set -euo pipefail
source "$HOME/.backup.env"
F="$1"; DEST="${2:-$HOME/restore-$(date +%s)}"
[ -f "$F.sha256" ] && sha256sum -c "$F.sha256"
mkdir -p "$DEST"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$PASSFILE" -in "$F" | tar -xf - -C "$DEST"
ls -lh "$DEST"
cat <<MSG
Đã giải mã vào: $DEST
Khôi phục MySQL:  gunzip -c $DEST/mysql-*.sql.gz | mysql -u <user> -p <database>
Khôi phục code:   tar -xzf $DEST/files.tar.gz -C /tmp/restore-files
MSG
