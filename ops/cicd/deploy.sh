#!/usr/bin/env bash
# ==========================================================
#  CI/CD: pull -> cài thư viện -> build -> restart -> health check
#  Build lỗi: giữ nguyên bản đang chạy, đưa code về commit cũ (rollback)
#  Health check lỗi sau restart: tự trả lại bản build cũ (rollback)
#  Gọi tự động từ webhook GitHub, hoặc chạy tay:  bash ops/cicd/deploy.sh
# ==========================================================
set -uo pipefail
unset NODE_ENV   # cần devDependencies (typescript, tailwind) để build
APP_DIR="${APP_DIR:-$HOME/apps/studynotion}"
source "$APP_DIR/ops/common.sh"
BRANCH=$(getenv DEPLOY_BRANCH "$ENV_FILE"); BRANCH=${BRANCH:-main}
PM2_NAME=${PM2_NAME:-studynotion}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3000/api/health}
DOMAIN=$(getenv NEXTAUTH_URL "$ENV_FILE")

# Chỉ 1 deploy chạy cùng lúc; cái sau chờ cái trước
# (các lệnh pm2 bên dưới đóng fd 9 để tiến trình con không giữ khóa)
exec 9>/tmp/studynotion-deploy.lock
flock 9

ts() { date '+%F %T'; }
log() { echo "[$(ts)] $*"; }
START=$(date +%s)
cd "$APP_DIR" || exit 1

PREV=$(git rev-parse HEAD)
log "===== DEPLOY bắt đầu (đang chạy: ${PREV:0:7}) ====="
if ! git fetch --quiet origin "$BRANCH"; then
  log "✗ git fetch lỗi"; tg_notify "❌ <b>Deploy lỗi</b>: không fetch được GitHub"; exit 1
fi
NEW=$(git rev-parse "origin/$BRANCH")
if [ "$PREV" = "$NEW" ] && [ "${FORCE:-0}" != "1" ]; then log "Không có thay đổi."; exit 0; fi

MSG=$(git log -1 --pretty='%s' "$NEW" | head -c 200)
AUTHOR=$(git log -1 --pretty='%an' "$NEW")
CHANGED_LOCK=$(git diff --name-only "$PREV" "$NEW" | grep -c '^package-lock.json$' || true)
tg_notify "🚀 <b>Bắt đầu deploy</b> <code>${NEW:0:7}</code>
👤 $AUTHOR
📝 $MSG"

rollback_code() {
  local reason="$1"
  log "✗ $reason -> rollback code về ${PREV:0:7}"
  git reset --hard --quiet "$PREV"
  [ "$CHANGED_LOCK" -gt 0 ] && npm ci --no-audit --no-fund >/dev/null 2>&1
  rm -rf .next-build
  local tail; tail=$(tail -n 15 "$BUILD_LOG" 2>/dev/null | sed 's/</\&lt;/g' | tail -c 1500)
  tg_notify "❌ <b>Deploy thất bại</b> (<code>${NEW:0:7}</code>): $reason
↩️ Đã rollback, web vẫn chạy bản <code>${PREV:0:7}</code>
<pre>$tail</pre>"
  log "===== DEPLOY THẤT BẠI ====="
  exit 1
}

BUILD_LOG=$(mktemp)
git reset --hard --quiet "$NEW"
log "Code -> ${NEW:0:7}: $MSG"

if [ "$CHANGED_LOCK" -gt 0 ] || [ ! -d node_modules ]; then
  log "package-lock thay đổi -> npm ci"
  npm ci --no-audit --no-fund >"$BUILD_LOG" 2>&1 || rollback_code "npm ci lỗi"
fi

log "Build vào .next-build (bản đang chạy không bị ảnh hưởng)"
rm -rf .next-build
NEXT_DIST_DIR=.next-build npm run build >"$BUILD_LOG" 2>&1 || rollback_code "build lỗi"
[ -f .next-build/BUILD_ID ] || rollback_code "build không tạo ra BUILD_ID"

log "Tráo bản build mới vào và restart"
rm -rf .next-prev
[ -d .next ] && mv .next .next-prev
mv .next-build .next
APP_VERSION="${NEW:0:7}" pm2 restart "$PM2_NAME" --update-env >/dev/null 9>&-

healthy=0
for _ in $(seq 1 20); do
  sleep 3
  if curl -sf -m 5 "$HEALTH_URL" | grep -q '"ok":true'; then healthy=1; break; fi
done

if [ $healthy -ne 1 ]; then
  log "✗ Health check lỗi -> trả lại bản build cũ"
  rm -rf .next-failed; mv .next .next-failed
  [ -d .next-prev ] && mv .next-prev .next
  git reset --hard --quiet "$PREV"
  [ "$CHANGED_LOCK" -gt 0 ] && npm ci --no-audit --no-fund >/dev/null 2>&1
  APP_VERSION="${PREV:0:7}" pm2 restart "$PM2_NAME" --update-env >/dev/null 9>&-
  tg_notify "❌ <b>Deploy lỗi</b>: bản <code>${NEW:0:7}</code> không khởi động được (health check fail)
↩️ Đã tự động rollback về <code>${PREV:0:7}</code>"
  log "===== DEPLOY ROLLBACK ====="
  exit 1
fi

echo "$NEW $(ts)" >> .deploy-history
pm2 save >/dev/null 2>&1 9>&- || true
DUR=$(( $(date +%s) - START ))
tg_notify "✅ <b>Deploy thành công</b> <code>${NEW:0:7}</code> (${DUR}s)
📝 $MSG
🌐 ${DOMAIN}"
log "===== DEPLOY OK (${DUR}s) ====="
rm -f "$BUILD_LOG"
