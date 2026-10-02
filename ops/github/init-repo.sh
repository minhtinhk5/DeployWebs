#!/usr/bin/env bash
# ==========================================================
#  Đưa code đang chạy trên VPS lên repo GitHub MỚI
#  Bước 1:  bash ops/github/init-repo.sh
#           -> in ra SSH key, thêm vào GitHub repo (Deploy keys, tick "Allow write access")
#  Bước 2:  bash ops/github/init-repo.sh git@github.com:<user>/<repo>.git
# ==========================================================
set -euo pipefail
source "$(dirname "$0")/../common.sh"
cd "$APP_DIR"
KEY="$HOME/.ssh/github_studynotion"

if [ ! -f "$KEY" ]; then
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  ssh-keygen -t ed25519 -N "" -C "deploy@$(hostname)-studynotion" -f "$KEY" >/dev/null
fi
if ! grep -q "github_studynotion" ~/.ssh/config 2>/dev/null; then
  cat >> ~/.ssh/config <<CFG

Host github.com
  HostName github.com
  User git
  IdentityFile $KEY
  IdentitiesOnly yes
CFG
  chmod 600 ~/.ssh/config
fi
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null; sort -u -o ~/.ssh/known_hosts ~/.ssh/known_hosts

REMOTE="${1:-}"
if [ -z "$REMOTE" ]; then
  cat <<MSG

==================== BƯỚC 1 ====================
1. Tạo repo MỚI trên https://github.com/new  (Private, KHÔNG tick README/.gitignore)
2. Vào repo -> Settings -> Deploy keys -> Add deploy key
   Title: vps-studynotion   |   Tick "Allow write access"
   Key (copy nguyên dòng dưới):

$(cat "$KEY.pub")

3. Chạy tiếp:  bash ops/github/init-repo.sh git@github.com:<user>/<repo>.git
================================================
MSG
  exit 0
fi

green "Kiểm tra quyền truy cập GitHub..."
SSH_OUT=$(ssh -T git@github.com 2>&1 || true); echo "$SSH_OUT" | grep -qi "successfully authenticated" || { echo "$SSH_OUT"; red "Chưa xác thực được. Kiểm tra Deploy key đã thêm & tick write access."; exit 1; }

# Repo cũ (nếu có) -> cất đi
if [ -d .git ]; then
  OLD=".git-old-$(date +%Y%m%d%H%M)"; mv .git "$OLD"; yellow "Đã cất repo git cũ vào $OLD"
fi

# Đưa code bot Telegram vào repo (không kèm .env)
mkdir -p tgbot && cp /opt/tgbot/bot.js /opt/tgbot/package.json tgbot/ 2>/dev/null || true
[ -f /opt/tgbot/.env.example ] && cp /opt/tgbot/.env.example tgbot/ || true

git init -q -b main
git config user.name  "${GIT_NAME:-$(whoami)}"
git config user.email "${GIT_EMAIL:-$(whoami)@$(hostname)}"
git add -A
# Chặn lỡ tay đẩy file bí mật
if git diff --cached --name-only | grep -E '(^|/)\.env($|\.local|\.production)|\.pem$|backup_pass|redis_admin'; then
  red "Phát hiện file bí mật bị add, dừng lại!"; git reset -q; exit 1
fi
git commit -qm "StudyNotion: Next.js + Telegram bot + Redis + CI/CD + ops scripts"
git remote add origin "$REMOTE"
git push -u origin main
green "✅ Đã đẩy code lên $REMOTE (nhánh main)"
git log --oneline -1
