#!/usr/bin/env bash
# ==========================================================
#  Minh chứng hiệu quả Index MySQL bằng EXPLAIN / EXPLAIN ANALYZE
#  - Tạo bảng thử bench_orders (giống bảng orders) với N dòng
#  - Đo truy vấn TRƯỚC và SAU khi tạo index
#  - In kế hoạch thực thi + thời gian, lưu báo cáo ~/index-benchmark-report.txt
#  Chạy:  bash ops/db/index-benchmark.sh [số_dòng=500000] [--keep]
# ==========================================================
set -euo pipefail
source "$(dirname "$0")/../common.sh"

ROWS="${1:-500000}"; KEEP="${2:-}"
[[ "$ROWS" =~ ^[0-9]+$ ]] || { KEEP="$ROWS"; ROWS=500000; }
HOST=$(getenv DB_HOST "$ENV_FILE"); PORT=$(getenv DB_PORT "$ENV_FILE")
USER=$(getenv DB_USERNAME "$ENV_FILE"); DB=$(getenv DB_NAME "$ENV_FILE")
export MYSQL_PWD; MYSQL_PWD=$(getenv DB_PASSWORD "$ENV_FILE")
REPORT="$HOME/index-benchmark-report.txt"
q()  { mysql -h "${HOST:-127.0.0.1}" -P "${PORT:-3306}" -u "$USER" "$DB" "$@"; }
qt() { q -t -e "$1"; }

VERSION=$(q -N -e "SELECT VERSION()")
IS_MARIA=0; [[ "$VERSION" == *MariaDB* ]] && IS_MARIA=1
exec > >(tee "$REPORT") 2>&1
green "== Máy chủ: $VERSION | DB: $DB | Số dòng thử: $ROWS"

Q1="SELECT id, amount, created_at FROM bench_orders WHERE status='Pending' ORDER BY created_at DESC LIMIT 20"
Q2="SELECT COUNT(*) AS so_don, SUM(amount) AS tong FROM bench_orders WHERE user_id='user-123' AND status='Paid'"

explain_analyze() {
  if [ $IS_MARIA = 1 ]; then qt "ANALYZE $1"; else q -e "EXPLAIN ANALYZE $1\G" | sed -n '1,12p'; fi
}

# đo thời gian thực thi trên server (SHOW PROFILES), trung bình 5 lần, đơn vị ms
# (tắt query cache của MariaDB để kết quả trung thực)
bench() {
  local nocache=""; [ $IS_MARIA = 1 ] && nocache="SET SESSION query_cache_type=OFF;"
  q -N -e "$nocache SET profiling_history_size=50; SET profiling=1;
    $1; $1; $1; $1; $1;
    SELECT ROUND(SUM(DURATION)*1000/5, 2) FROM information_schema.PROFILING
    WHERE QUERY_ID BETWEEN 1 AND 5;" 2>/dev/null | tail -1
}

green "[1/5] Tạo bảng thử bench_orders ($ROWS dòng, chưa có index phụ)"
q -e "DROP TABLE IF EXISTS bench_orders, bench_digits;
CREATE TABLE bench_digits (d TINYINT PRIMARY KEY);
INSERT INTO bench_digits VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9);
CREATE TABLE bench_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  status ENUM('Pending','Paid','Rejected','Cancelled') NOT NULL,
  amount DOUBLE NOT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB;
INSERT INTO bench_orders (user_id, status, amount, created_at)
SELECT CONCAT('user-', n % 5000),
       ELT(1 + IF(n % 20 = 0, 0, IF(n % 20 = 1, 2, IF(n % 20 = 2, 3, 1))), 'Pending','Paid','Rejected','Cancelled'),
       (n % 50 + 1) * 10000,
       NOW() - INTERVAL n MINUTE
FROM (SELECT a.d + b.d*10 + c.d*100 + e.d*1000 + f.d*10000 + g.d*100000 AS n
      FROM bench_digits a, bench_digits b, bench_digits c, bench_digits e, bench_digits f, bench_digits g) s
WHERE n < $ROWS;
ANALYZE TABLE bench_orders;" >/dev/null
qt "SELECT status, COUNT(*) AS so_dong FROM bench_orders GROUP BY status"

green "[2/5] TRƯỚC khi đánh index"
echo "--- EXPLAIN Q1: $Q1"; qt "EXPLAIN $Q1"
echo "--- EXPLAIN Q2: $Q2"; qt "EXPLAIN $Q2"
echo "--- EXPLAIN ANALYZE Q1 (thời gian thực tế)"; explain_analyze "$Q1"
B1=$(bench "$Q1"); B2=$(bench "$Q2")
yellow "Thời gian TB: Q1 = ${B1} ms | Q2 = ${B2} ms"

green "[3/5] Tạo index"
qt "CREATE INDEX idx_bench_status_created ON bench_orders (status, created_at);
    CREATE INDEX idx_bench_user_status ON bench_orders (user_id, status);
    SHOW INDEX FROM bench_orders"

green "[4/5] SAU khi đánh index"
echo "--- EXPLAIN Q1"; qt "EXPLAIN $Q1"
echo "--- EXPLAIN Q2"; qt "EXPLAIN $Q2"
echo "--- EXPLAIN ANALYZE Q1"; explain_analyze "$Q1"
A1=$(bench "$Q1"); A2=$(bench "$Q2")
yellow "Thời gian TB: Q1 = ${A1} ms | Q2 = ${A2} ms"

green "[5/5] Index trên các bảng thật của ứng dụng (TypeORM tự tạo)"
for t in courses orders users ratings_and_reviews course_progress cart_items; do
  echo "--- $t"; q -t -e "SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cot, IF(NON_UNIQUE=0,'UNIQUE','') AS loai
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='$DB' AND TABLE_NAME='$t' GROUP BY INDEX_NAME, NON_UNIQUE" 2>/dev/null || true
done
echo "--- Truy vấn catalog thật dùng index:"
qt "EXPLAIN SELECT id FROM courses WHERE status='Public' ORDER BY createdAt DESC LIMIT 20"

sp() { awk -v b="$1" -v a="$2" 'BEGIN{ if (a<0.01) a=0.01; printf "%.0fx", b/a }'; }
echo
green "================= KẾT QUẢ ================="
echo "Q1 (đơn Pending mới nhất):      trước ${B1} ms  ->  sau ${A1} ms   (nhanh hơn $(sp "$B1" "$A1"))"
echo "Q2 (tổng đơn Paid 1 học viên):  trước ${B2} ms  ->  sau ${A2} ms   (nhanh hơn $(sp "$B2" "$A2"))"
echo "Báo cáo đã lưu: $REPORT"

if [ "$KEEP" != "--keep" ]; then q -e "DROP TABLE IF EXISTS bench_orders, bench_digits"; echo "(Đã xóa bảng thử. Dùng --keep để giữ lại.)"; fi
