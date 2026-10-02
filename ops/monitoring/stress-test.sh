#!/usr/bin/env bash
# Tạo tải CPU giả 7 phút để kiểm tra cảnh báo Netdata -> Telegram
sudo apt-get install -y -qq stress-ng >/dev/null
CORES=$(nproc)
echo "Chạy stress-ng $CORES nhân trong 7 phút... (Ctrl+C để dừng sớm)"
stress-ng --cpu "$CORES" --cpu-load 100 --timeout 420s --metrics-brief
echo "Xong. Sau ~5 phút Telegram sẽ nhận cảnh báo 'CLEAR' khi CPU về bình thường."
