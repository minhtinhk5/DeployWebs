#!/usr/bin/env bash
# Rollback thủ công về bản build trước (.next-prev) và commit trước đó
set -euo pipefail
APP_DIR="${APP_DIR:-$HOME/apps/studynotion}"; source "$APP_DIR/ops/common.sh"; cd "$APP_DIR"
[ -d .next-prev ] || { red "Không có bản build trước (.next-prev)"; exit 1; }
PREV=$(tail -n 2 .deploy-history 2>/dev/null | head -1 | awk '{print $1}')
mv .next .next-failed-manual && mv .next-prev .next
[ -n "$PREV" ] && git reset --hard "$PREV"
pm2 restart studynotion --update-env
tg_notify "↩️ <b>Rollback thủ công</b> về <code>${PREV:0:7}</code>"
green "Đã rollback về ${PREV:0:7}"
