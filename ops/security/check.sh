#!/usr/bin/env bash
# Kiểm tra & minh chứng cấu hình bảo mật (chụp màn hình cho báo cáo)
sudo -v
echo "===== UFW ====="; sudo ufw status numbered
echo; echo "===== Cổng đang mở ra ngoài ====="; sudo ss -tulpn | awk 'NR==1 || /LISTEN/' | grep -vE "127.0.0.1|\[::1\]"
echo; echo "===== Fail2ban ====="; sudo fail2ban-client status
for j in $(sudo fail2ban-client status | sed -n 's/.*Jail list:\s*//p' | tr ',' ' '); do sudo fail2ban-client status "$j" | sed 's/^/  /'; done
echo; echo "===== Thử rate limit: 300 request đồng thời (50 luồng) vào trang chủ ====="
DOMAIN=${1:-minhtinhnodejs.cocopie.xyz}
seq 1 300 | xargs -P 50 -I{} curl -s -o /dev/null -w "%{http_code}\n" "https://$DOMAIN/" | sort | uniq -c
echo "(429 = bị nginx giới hạn → rate limit hoạt động)"
echo; echo "===== SYN cookies ====="; sysctl net.ipv4.tcp_syncookies
