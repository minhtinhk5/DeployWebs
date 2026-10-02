"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { FiShoppingCart } from "react-icons/fi";

type Props = {
  courseId: string;
  price: number;
  state: "guest" | "owner" | "enrolled" | "incart" | "none";
  pendingOrderId?: string | null;
};

export default function BuyBox({ courseId, price, state, pendingOrderId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const free = Number(price) === 0;

  const addToCart = async () => {
    setBusy(true);
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!res?.success) return toast.error(res?.message || "Lỗi");
    toast.success(res.message);
    router.refresh();
  };

  const buyNow = async () => {
    setBusy(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseIds: [courseId] }),
    }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!res?.success) return toast.error(res?.message || "Lỗi");
    if (res.enrolled) {
      toast.success("Đăng ký thành công! 🎉");
      router.push(`/learn/${courseId}`);
    } else router.push(`/dashboard/checkout/${res.orderId}`);
    router.refresh();
  };

  const btn = "flex w-full items-center justify-center gap-2 rounded-md py-3 font-semibold disabled:opacity-50";

  if (state === "guest")
    return (
      <Link href="/auth/login" className={`${btn} bg-yellow-50 text-richblack-900`}>
        Đăng nhập để {free ? "đăng ký" : "mua"} khóa học
      </Link>
    );
  if (state === "owner")
    return (
      <Link href={`/dashboard/edit-course/${courseId}`} className={`${btn} bg-richblack-700 text-richblack-5`}>
        Đây là khóa học của bạn — Sửa
      </Link>
    );
  if (state === "enrolled")
    return (
      <Link href={`/learn/${courseId}`} className={`${btn} bg-yellow-50 text-richblack-900`}>
        Vào học ngay →
      </Link>
    );

  return (
    <div className="flex flex-col gap-3">
      {pendingOrderId && (
        <Link href={`/dashboard/checkout/${pendingOrderId}`} className="rounded-md border border-yellow-50 p-3 text-center text-sm text-yellow-50">
          ⏳ Bạn có đơn đang chờ xác nhận — xem đơn
        </Link>
      )}
      <button onClick={buyNow} disabled={busy} className={`${btn} bg-yellow-50 text-richblack-900`}>
        {free ? "Đăng ký miễn phí" : "Mua ngay"}
      </button>
      {!free &&
        (state === "incart" ? (
          <Link href="/dashboard/cart" className={`${btn} bg-richblack-700 text-richblack-5`}>
            <FiShoppingCart /> Đã trong giỏ — Xem giỏ hàng
          </Link>
        ) : (
          <button onClick={addToCart} disabled={busy} className={`${btn} border border-richblack-400 text-richblack-5`}>
            <FiShoppingCart /> Thêm vào giỏ
          </button>
        ))}
    </div>
  );
}
