#!/usr/bin/env bash
# Hàm dùng chung cho các script ops
APP_DIR="${APP_DIR:-$HOME/apps/studynotion}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
BOT_ENV="${BOT_ENV:-/opt/tgbot/.env}"

green()  { echo -e "\e[32m$*\e[0m"; }
yellow() { echo -e "\e[33m$*\e[0m"; }
red()    { echo -e "\e[31m$*\e[0m"; }

# Đọc biến từ file .env (không source để tránh lỗi ký tự đặc biệt)
getenv() { { grep -E "^$1=" "$2" 2>/dev/null || true; } | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

# Ghi/ghi đè biến vào file .env
setenv() {
  local key="$1" val="$2" file="$3"
  touch "$file"
  if grep -qE "^$key=" "$file"; then
    sed -i "s|^$key=.*|$key=$val|" "$file"
  else
    echo "$key=$val" >> "$file"
  fi
}

# Gửi thông báo Telegram qua bot service nội bộ (127.0.0.1:3100)
tg_notify() {
  local text="$1"
  local key; key=$(getenv TELEGRAM_API_KEY "$ENV_FILE")
  [ -z "$key" ] && key=$(getenv API_KEY "$BOT_ENV")
  [ -z "$key" ] && return 0
  local json; json=$(node -e 'process.stdout.write(JSON.stringify({text: process.argv[1], parse_mode: "HTML"}))' "$text")
  curl -s -m 10 -X POST http://127.0.0.1:3100/notify \
    -H "Content-Type: application/json" -H "x-api-key: $key" -d "$json" >/dev/null || true
}
