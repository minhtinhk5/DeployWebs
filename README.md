# StudyNotion

Nền tảng học trực tuyến viết bằng **Next.js 14 + TypeORM (MySQL) + Redis**, tích hợp **bot Telegram**, triển khai trên VPS Ubuntu 24.04 (CloudPanel) với CI/CD tự động.

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Web | Next.js 14 (App Router), NextAuth, Tailwind | `pm2` tên `studynotion`, cổng 3000 |
| CSDL chính | MySQL / MariaDB qua TypeORM | có index tối ưu truy vấn |
| CSDL thứ 2 (NoSQL) | Redis 7 | cache + rate limit, ACL riêng cho app |
| Bot | grammY (`tgbot/`) | `pm2` tên `tgbot`, API nội bộ 127.0.0.1:3100 |
| CI/CD | GitHub Webhook → `/api/deploy/github` | build lỗi tự rollback |
| Giám sát | Netdata | cảnh báo Telegram |
| Backup | cron + mysqldump + AES-256 | đồng bộ Telegram / rclone |

## Tính năng

- **Học viên:** xem danh sách khóa học, giỏ hàng, thanh toán VietQR (admin duyệt trên Telegram), học bài có video, lưu tiến độ, đánh giá khóa học sau khi học xong.
- **Giảng viên:** dashboard thống kê, tạo/sửa khóa học (chương, bài học), xuất bản.
- **Telegram:** liên kết tài khoản bằng QR, cảnh báo đăng nhập, mã khôi phục mật khẩu, thông báo đơn hàng/đánh giá, lệnh `/stats`, `/orders`, `/courses`.

## Chạy local

```bash
cp .env.example .env     # điền DB_*, NEXTAUTH_SECRET, REDIS_URL...
npm ci
npm run dev
```

## Vận hành trên VPS (thư mục `ops/`)

Chạy lần lượt trên VPS, tại thư mục `~/apps/studynotion`:

| # | Yêu cầu | Lệnh | Minh chứng |
|---|---|---|---|
| 4 | Redis làm CSDL thứ 2 | `bash ops/redis/setup-redis.sh` | `bash ops/redis/redis-demo.sh`, `curl localhost:3000/api/health` |
| 5 | Index + EXPLAIN | (index tự tạo khi app khởi động) `bash ops/db/index-benchmark.sh` | file `~/index-benchmark-report.txt` |
| 6 | SSL (CloudPanel) + cipher mạnh | `bash ops/security/ssl-harden.sh <domain1> <domain2>` | SSL Labs |
| 7 | UFW + Fail2ban + rate limit | `bash ops/security/setup-firewall.sh` | `bash ops/security/check.sh` |
| 8 | CI/CD GitHub Webhook | `bash ops/cicd/setup-cicd.sh` | `tail -f ~/logs/deploy.log` |
| 9 | Netdata + cảnh báo | `bash ops/monitoring/setup-netdata.sh` | `bash ops/monitoring/stress-test.sh` |
| 10 | Backup mã hóa tự động | `bash ops/backup/setup-backup.sh` | `ls ~/backups/auto`, `~/logs/backup.log` |

### Luồng CI/CD

```
git push (main) ──► GitHub Webhook (HMAC-SHA256) ──► https://<domain>/api/deploy/github
                                                            │ (tách tiến trình)
                                                            ▼
              ops/cicd/deploy.sh: fetch → npm ci (nếu đổi lock) → build vào .next-build
                    ├─ build lỗi  → git reset về commit cũ, web cũ vẫn chạy     → Telegram ❌
                    └─ build OK   → tráo .next, pm2 restart → /api/health
                                         ├─ health lỗi → trả lại .next-prev     → Telegram ↩️
                                         └─ OK                                   → Telegram ✅
```

Rollback thủ công: `bash ops/cicd/rollback.sh`.

### Bảo mật đã áp dụng

- Redis: chỉ nghe `127.0.0.1`, user `app` bị giới hạn key `sn:*` và cấm các lệnh nguy hiểm; `maxmemory 128mb` + `allkeys-lru`.
- UFW chỉ mở SSH (có `limit`), 80, 443, 8443; Fail2ban chặn brute-force SSH và IP spam vượt rate limit của nginx; nginx giới hạn 20 req/s mỗi IP; sysctl bật SYN cookies.
- App: rate limit OTP/đăng nhập/form bằng Redis, chữ ký webhook, khóa API nội bộ cho bot, mật khẩu bcrypt.
- Backup mã hóa AES-256 (PBKDF2 200k vòng), file quyền 600, tự xóa sau 7 ngày.
