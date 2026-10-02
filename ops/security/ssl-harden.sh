#!/usr/bin/env bash
# ==========================================================
#  Tối ưu SSL cho mọi website trên nginx (CloudPanel):
#  chỉ TLS 1.2/1.3, cipher mạnh (ECDHE + AES-GCM/CHACHA20), OCSP stapling, session cache
#  Chạy:  bash ops/security/ssl-harden.sh
# ==========================================================
set -euo pipefail
sudo -v
F=/etc/nginx/conf.d/01-ssl-hardening.conf
sudo tee "$F" >/dev/null <<'NGX'
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_ecdh_curve X25519:secp384r1:prime256v1;
ssl_session_cache shared:SSL_HARDEN:20m;
ssl_session_timeout 1d;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
NGX
if sudo nginx -t 2>/tmp/ssl-test.log; then
  sudo systemctl reload nginx; echo "✅ Đã áp dụng cấu hình SSL mạnh."
else
  # CloudPanel có thể đã khai báo sẵn một số dòng -> bỏ các dòng bị trùng rồi thử lại
  for d in $(grep -oE 'duplicate "[a-z_]+"' /tmp/ssl-test.log | grep -oE '"[a-z_]+"' | tr -d '"' | sort -u); do
    echo "  bỏ dòng trùng: $d"; sudo sed -i "/^$d /d" "$F"
  done
  if sudo nginx -t 2>/tmp/ssl-test.log; then sudo systemctl reload nginx; echo "✅ Đã áp dụng (bỏ các dòng CloudPanel đã có)."; 
  else cat /tmp/ssl-test.log; sudo rm -f "$F"; echo "✗ Gỡ cấu hình, giữ nguyên mặc định CloudPanel."; fi
fi
echo; echo "Kiểm tra giao thức:"
for d in "$@"; do
  for v in tls1_1 tls1_2 tls1_3; do
    r=$(echo | timeout 5 openssl s_client -connect "$d:443" -servername "$d" -"$v" 2>/dev/null | grep -c "BEGIN CERTIFICATE" || true)
    echo "  $d $v: $([ "$r" -gt 0 ] && echo 'BẬT' || echo 'tắt')"
  done
done
echo "Chấm điểm online: https://www.ssllabs.com/ssltest/"
