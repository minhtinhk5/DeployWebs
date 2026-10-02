#!/usr/bin/env bash
# Minh chứng Redis đang được ứng dụng sử dụng (chụp màn hình cho báo cáo)
source "$(dirname "$0")/../common.sh"
source "$HOME/.redis_admin"
R="redis-cli --no-auth-warning -a $REDIS_ADMIN_PASS"
echo "== Phiên bản & bộ nhớ";   $R INFO server | grep redis_version; $R INFO memory | grep -E "used_memory_human|maxmemory_human|maxmemory_policy"
echo "== Số key của app";       $R --scan --pattern 'sn:*' | head -20
echo "== Gọi trang /catalog 2 lần để thấy cache"
for i in 1 2; do /usr/bin/time -f "  lần $i: %es" curl -s -o /dev/null http://127.0.0.1:3000/catalog; done
echo "== TTL của key catalog";  for k in $($R --scan --pattern 'sn:catalog:*'); do echo "  $k -> $($R TTL "$k")s"; done
echo "== Health";               curl -s http://127.0.0.1:3000/api/health; echo
echo "== Thử truy cập từ ngoài (phải bị từ chối):"; ss -ltnp 2>/dev/null | grep 6379
