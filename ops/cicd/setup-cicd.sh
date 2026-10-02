#!/usr/bin/env bash
# ==========================================================
#  Bật CI/CD qua GitHub Webhook
#  Chạy:  bash ops/cicd/setup-cicd.sh
# ==========================================================
set -euo pipefail
source "$(dirname "$0")/../common.sh"
cd "$APP_DIR"
git remote get-url origin >/dev/null 2>&1 || { red "Chưa có git remote origin. Làm phần GitHub trước."; exit 1; }

SECRET=$(getenv DEPLOY_WEBHOOK_SECRET "$ENV_FILE")
[ -z "$SECRET" ] && SECRET=$(openssl rand -hex 32) && setenv DEPLOY_WEBHOOK_SECRET "$SECRET" "$ENV_FILE"
setenv DEPLOY_BRANCH "$(git rev-parse --abbrev-ref HEAD)" "$ENV_FILE"
mkdir -p "$HOME/logs"
chmod +x ops/cicd/*.sh

git fetch --quiet origin && green "✓ VPS truy cập được GitHub"
pm2 restart studynotion --update-env >/dev/null && sleep 5
curl -s -o /dev/null -w "Webhook endpoint (không chữ ký phải trả 401): %{http_code}\n" -X POST http://127.0.0.1:3000/api/deploy/github

DOMAIN=$(getenv NEXTAUTH_URL "$ENV_FILE")
cat <<MSG

============ Thêm Webhook trên GitHub ============
Repo -> Settings -> Webhooks -> Add webhook
  Payload URL : ${DOMAIN%/}/api/deploy/github
  Content type: application/json
  Secret      : $SECRET
  Events      : Just the push event
Bấm "Add webhook" -> GitHub gửi ping, phải thấy dấu ✓ xanh.
Theo dõi deploy:  tail -f ~/logs/deploy.log
==================================================
MSG
