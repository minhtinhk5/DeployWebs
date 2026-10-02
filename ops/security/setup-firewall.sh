#!/usr/bin/env bash
# ==========================================================
#  Bảo mật hệ thống: UFW + Fail2ban + Nginx rate limit + sysctl chống SYN flood
#  Chạy:  bash ops/security/setup-firewall.sh            (mở 8443 cho mọi IP)
#         ADMIN_IP=1.2.3.4 bash ops/security/setup-firewall.sh  (chỉ IP này vào được CloudPanel)
# ==========================================================
set -euo pipefail
source "$(dirname "$0")/../common.sh"
sudo -v

SSH_PORT=$(sudo sshd -T 2>/dev/null | awk '/^port /{print $2; exit}'); SSH_PORT=${SSH_PORT:-22}
CP_PORT=${CP_PORT:-8443}
ADMIN_IP=${ADMIN_IP:-}
green "SSH port: $SSH_PORT | CloudPanel port: $CP_PORT ${ADMIN_IP:+(chỉ cho $ADMIN_IP)}"

# ---------------- 1. UFW ----------------
green "[1/4] Cấu hình UFW"
sudo apt-get install -y -qq ufw fail2ban >/dev/null
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw limit "$SSH_PORT"/tcp comment 'SSH (chống brute-force: >6 kết nối/30s bị chặn)'
sudo ufw allow 80/tcp  comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow 443/udp comment 'HTTP/3'
if [ -n "$ADMIN_IP" ]; then
  sudo ufw allow from "$ADMIN_IP" to any port "$CP_PORT" proto tcp comment 'CloudPanel (admin)'
else
  sudo ufw allow "$CP_PORT"/tcp comment 'CloudPanel'
fi
sudo ufw logging low
sudo ufw --force enable
sudo ufw status verbose

# ---------------- 2. Fail2ban ----------------
green "[2/4] Cấu hình Fail2ban (chặn IP brute-force)"
PUBLIC_IP=$(curl -s -4 -m 5 ifconfig.me || true)
NGINX_LOGS=$(ls /home/*/logs/nginx/error.log /var/log/nginx/error.log 2>/dev/null | tr '\n' ' ' || true)
sudo tee /etc/fail2ban/jail.local >/dev/null <<JAIL
[DEFAULT]
# Không bao giờ chặn localhost, IP của chính VPS${ADMIN_IP:+ và IP quản trị}
ignoreip = 127.0.0.1/8 ::1 ${PUBLIC_IP} ${ADMIN_IP}
bantime  = 1h
findtime = 10m
maxretry = 5
# Tái phạm thì thời gian chặn tăng dần (1h, 2h, 4h...)
bantime.increment = true
bantime.maxtime   = 1w
banaction = ufw

[sshd]
enabled  = true
port     = $SSH_PORT
backend  = systemd
maxretry = 4

[recidive]
enabled  = true
logpath  = /var/log/fail2ban.log
bantime  = 1w
findtime = 1d
maxretry = 3
JAIL
if [ -n "$NGINX_LOGS" ]; then
  sudo tee -a /etc/fail2ban/jail.local >/dev/null <<JAIL

# IP liên tục vượt rate limit của nginx (dấu hiệu DoS) -> chặn ở firewall
[nginx-limit-req]
enabled  = true
port     = http,https
logpath  = $NGINX_LOGS
findtime = 1m
maxretry = 20
bantime  = 2h
JAIL
fi
sudo systemctl enable fail2ban >/dev/null 2>&1
sudo systemctl restart fail2ban
sleep 2
sudo fail2ban-client status

# ---------------- 3. Nginx rate limit ----------------
green "[3/4] Nginx rate limit chống DoS (áp dụng mọi website)"
if grep -qE "include\s+/etc/nginx/conf.d/\*.conf" /etc/nginx/nginx.conf; then
  sudo tee /etc/nginx/conf.d/00-ratelimit.conf >/dev/null <<'NGX'
# Không giới hạn request nội bộ (127.0.0.1): webhook, health check...
geo $rl_exempt { default 0; 127.0.0.1 1; ::1 1; }
map $rl_exempt $rl_key { 0 $binary_remote_addr; 1 ""; }

# Tối đa 20 request/giây mỗi IP (cho phép dồn 60), tối đa 40 kết nối đồng thời mỗi IP
limit_req_zone  $rl_key zone=perip:20m rate=20r/s;
limit_conn_zone $rl_key zone=connperip:20m;
limit_req  zone=perip burst=60 nodelay;
limit_conn connperip 40;
limit_req_status  429;
limit_conn_status 429;

# Cắt kết nối chậm (slowloris)
client_body_timeout   15s;
client_header_timeout 15s;
send_timeout          30s;
NGX
  if sudo nginx -t 2>/tmp/nginx-test.log; then
    sudo systemctl reload nginx && green "  ✓ Đã bật rate limit nginx"
  else
    red "  ✗ nginx -t lỗi, gỡ cấu hình rate limit:"; cat /tmp/nginx-test.log
    sudo rm -f /etc/nginx/conf.d/00-ratelimit.conf
  fi
else
  yellow "  ⚠ nginx.conf không include conf.d/*.conf – bỏ qua bước này"
fi

# ---------------- 4. Kernel chống SYN flood ----------------
green "[4/4] sysctl chống SYN flood / giả mạo IP"
sudo tee /etc/sysctl.d/99-hardening.conf >/dev/null <<'SYS'
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.tcp_synack_retries = 2
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
SYS
sudo sysctl --system >/dev/null

green "✅ Hoàn tất. Kiểm tra: bash ops/security/check.sh"
yellow "Mở một cửa sổ SSH MỚI để chắc chắn vẫn đăng nhập được trước khi đóng cửa sổ hiện tại."
