#!/usr/bin/env bash
# ==========================================================
#  Cài Redis 7 làm CSDL thứ 2 (NoSQL) + bảo mật + tối ưu bộ nhớ
#  Chạy:  bash ~/apps/studynotion/ops/redis/setup-redis.sh
# ==========================================================
set -euo pipefail
source "$(dirname "$0")/../common.sh"

sudo -v
if ! command -v redis-server >/dev/null; then
  green "[1/4] Cài redis-server"
  sudo apt-get update -qq && sudo apt-get install -y -qq redis-server
fi

ADMIN_PASS=$(openssl rand -hex 24)
APP_PASS=$(openssl rand -hex 24)
CONF=/etc/redis/redis.conf
sudo cp -n "$CONF" "$CONF.orig" || true

green "[2/4] Ghi cấu hình bảo mật & tối ưu"
# Xóa khối cấu hình cũ của script (nếu chạy lại)
sudo sed -i '/# >>> studynotion >>>/,/# <<< studynotion <<</d' "$CONF"
sudo tee -a "$CONF" >/dev/null <<CFG
# >>> studynotion >>>
## --- Bảo mật ---
# chỉ nghe nội bộ, không mở ra Internet
bind 127.0.0.1 -::1
protected-mode yes
port 6379
# user 'default' = quản trị (backup, giám sát)
requirepass $ADMIN_PASS
# User riêng cho ứng dụng: chỉ được truy cập key sn:*, cấm lệnh nguy hiểm
user app on >$APP_PASS ~sn:* &* +@all -@dangerous +info
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command DEBUG ""
## --- Tối ưu dung lượng ---
# giới hạn RAM cho Redis
maxmemory 128mb
# đầy thì tự xóa key ít dùng nhất
maxmemory-policy allkeys-lru
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
save 900 1
save 300 100
rdbcompression yes
# dữ liệu là cache/rate-limit -> không cần AOF
appendonly no
supervised systemd
# <<< studynotion <<<
CFG

sudo systemctl enable redis-server >/dev/null 2>&1 || true
sudo systemctl restart redis-server
sleep 1

green "[3/4] Kiểm tra kết nối"
redis-cli --no-auth-warning --user app --pass "$APP_PASS" SET sn:healthcheck ok EX 10 >/dev/null
redis-cli --no-auth-warning --user app --pass "$APP_PASS" GET sn:healthcheck
if redis-cli --no-auth-warning --user app --pass "$APP_PASS" SET other:key x 2>&1 | grep -q NOPERM; then
  green "  ✓ ACL hoạt động: user app không ghi được key ngoài sn:*"
fi

green "[4/4] Ghi REDIS_URL vào $ENV_FILE"
setenv REDIS_URL "redis://app:$APP_PASS@127.0.0.1:6379/0" "$ENV_FILE"
umask 077
cat > "$HOME/.redis_admin" <<EOP
REDIS_ADMIN_PASS=$ADMIN_PASS
EOP
chmod 600 "$HOME/.redis_admin"

pm2 restart studynotion --update-env >/dev/null 2>&1 || true
sleep 4
curl -s http://127.0.0.1:3000/api/health || true
echo
green "✅ Redis sẵn sàng. Mật khẩu admin lưu ở ~/.redis_admin (chmod 600)."
