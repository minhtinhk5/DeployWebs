#!/usr/bin/env bash
# ==========================================================
#  Netdata: giám sát VPS thời gian thực + cảnh báo Telegram
#  - CPU > 80% (5 phút), RAM > 85%, ổ đĩa, website sập (httpcheck)
#  Chạy:  bash ops/monitoring/setup-netdata.sh
# ==========================================================
set -euo pipefail
source "$(dirname "$0")/../common.sh"
sudo -v

NODE_URL=$(getenv NEXTAUTH_URL "$ENV_FILE"); NODE_URL=${NODE_URL%/}
STATIC_URL=${STATIC_URL:-https://minhtinhstatic.cocopie.xyz}
TOKEN=$(getenv BOT_TOKEN "$BOT_ENV")
CHAT=$(getenv ADMIN_CHAT_ID "$BOT_ENV" | cut -d, -f1)
[ -n "$TOKEN" ] && [ -n "$CHAT" ] || { red "Không đọc được BOT_TOKEN / ADMIN_CHAT_ID trong $BOT_ENV"; exit 1; }

if ! command -v netdata >/dev/null && [ ! -x /opt/netdata/bin/netdata ]; then
  green "[1/5] Cài Netdata (vài phút)"
  curl -fsSL https://get.netdata.cloud/kickstart.sh -o /tmp/netdata-kickstart.sh
  sudo sh /tmp/netdata-kickstart.sh --stable-channel --disable-telemetry --non-interactive
fi
CONF_DIR=/etc/netdata; [ -d /opt/netdata/etc/netdata ] && CONF_DIR=/opt/netdata/etc/netdata
green "Thư mục cấu hình: $CONF_DIR"

green "[2/5] Chỉ cho truy cập dashboard từ nội bộ (127.0.0.1:19999)"
if sudo grep -q "^\[web\]" "$CONF_DIR/netdata.conf" 2>/dev/null; then
  sudo sed -i '/^\[web\]/,/^\[/{s/^\s*#\?\s*bind to = .*/    bind to = 127.0.0.1/}' "$CONF_DIR/netdata.conf"
  sudo grep -q "bind to = 127.0.0.1" "$CONF_DIR/netdata.conf" || sudo sed -i '/^\[web\]/a\    bind to = 127.0.0.1' "$CONF_DIR/netdata.conf"
else
  printf '[web]\n    bind to = 127.0.0.1\n' | sudo tee -a "$CONF_DIR/netdata.conf" >/dev/null
fi

green "[3/5] Cảnh báo qua Telegram"
sudo tee "$CONF_DIR/health_alarm_notify.conf" >/dev/null <<CFG
# Gửi cảnh báo Netdata về Telegram admin
SEND_TELEGRAM="YES"
TELEGRAM_BOT_TOKEN="$TOKEN"
DEFAULT_RECIPIENT_TELEGRAM="$CHAT"
CFG
sudo chmod 640 "$CONF_DIR/health_alarm_notify.conf"
sudo chown root:netdata "$CONF_DIR/health_alarm_notify.conf" 2>/dev/null || true

green "[4/5] Ngưỡng cảnh báo CPU / RAM"
sudo mkdir -p "$CONF_DIR/health.d"
sudo tee "$CONF_DIR/health.d/studynotion.conf" >/dev/null <<'CFG'
# CPU trung bình 5 phút
 alarm: vps_cpu_overload
    on: system.cpu
lookup: average -5m unaligned of user,system,softirq,irq,guest
 units: %
 every: 1m
  warn: $this > 80
  crit: $this > 95
 delay: down 5m
  info: CPU VPS quá tải (trung bình 5 phút)
    to: sysadmin

# RAM đang dùng (%)
 alarm: vps_ram_overload
    on: system.ram
  calc: $used * 100 / ($used + $cached + $free + $buffers)
 units: %
 every: 1m
  warn: $this > 85
  crit: $this > 95
 delay: down 5m
  info: RAM VPS sắp hết
    to: sysadmin
CFG

green "[5/5] Kiểm tra website mỗi 30 giây (httpcheck)"
sudo mkdir -p "$CONF_DIR/go.d"
sudo tee "$CONF_DIR/go.d/httpcheck.conf" >/dev/null <<CFG
jobs:
  - name: studynotion_node
    url: $NODE_URL/api/health
    status_accepted: [200]
    timeout: 10
    update_every: 30
  - name: studynotion_static
    url: $STATIC_URL/
    status_accepted: [200]
    timeout: 10
    update_every: 30
CFG

sudo systemctl restart netdata
sleep 5
curl -s -o /dev/null -w "Netdata API: %{http_code}\n" http://127.0.0.1:19999/api/v1/info || true

NOTIFY=$(ls /usr/libexec/netdata/plugins.d/alarm-notify.sh /opt/netdata/usr/libexec/netdata/plugins.d/alarm-notify.sh 2>/dev/null | head -1)
if [ -n "$NOTIFY" ]; then
  green "Gửi tin thử nghiệm về Telegram..."
  sudo -u netdata bash "$NOTIFY" test 2>&1 | tail -3 || true
fi

cat <<MSG

✅ Netdata đã chạy.
Xem dashboard trên máy tính (an toàn, không mở cổng ra Internet):
  1) Trên máy tính chạy:  ssh -L 19999:127.0.0.1:19999 $(whoami)@$(curl -s -4 ifconfig.me 2>/dev/null || echo IP_VPS)
  2) Mở trình duyệt:      http://localhost:19999
Thử cảnh báo CPU:  bash ops/monitoring/stress-test.sh
MSG
