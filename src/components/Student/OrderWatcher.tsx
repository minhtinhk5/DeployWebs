"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

/** Hỏi lại trạng thái đơn mỗi 5 giây, tự tải lại trang khi admin xác nhận */
export default function OrderWatcher({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== "Pending") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (res?.status && res.status !== "Pending") {
        clearInterval(t);
        if (res.status === "Paid") toast.success("Thanh toán đã được xác nhận! 🎉");
        router.refresh();
      }
    }, 5000);
    return () => clearInterval(t);
  }, [orderId, status, router]);

  if (status !== "Pending") return null;

  const cancel = async () => {
    if (!confirm("Hủy đơn hàng này?")) return;
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!res?.success) return toast.error(res?.message || "Lỗi");
    toast.success(res.message);
    router.push("/dashboard/cart");
    router.refresh();
  };

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <p className="flex items-center gap-2 text-yellow-50">
        <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-50" /> Đang chờ xác nhận thanh toán...
      </p>
      <button onClick={cancel} disabled={busy} className="text-richblack-300 underline">
        Hủy đơn
      </button>
    </div>
  );
}
