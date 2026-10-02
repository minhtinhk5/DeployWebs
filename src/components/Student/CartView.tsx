"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { FiBookOpen, FiShoppingCart, FiTrash2 } from "react-icons/fi";

export type CartRow = {
  courseId: string;
  courseName: string;
  thumbnail: string | null;
  instructor: string;
  price: number;
  lectures: number;
};

const vnd = (n: number) =>
  Number(n) === 0 ? "Miễn phí" : `${Math.round(Number(n)).toLocaleString("vi-VN")} ₫`;

export default function CartView({ items }: { items: CartRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const total = items.reduce((n, i) => n + i.price, 0);

  const remove = async (courseId: string) => {
    setBusy(true);
    const res = await fetch("/api/cart", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!res?.success) return toast.error("Lỗi");
    toast.success(res.message);
    router.refresh();
  };

  const checkout = async () => {
    setBusy(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!res?.success) return toast.error(res?.message || "Lỗi");
    if (res.enrolled) {
      toast.success("Đăng ký thành công! 🎉");
      router.push("/dashboard/enrolled-courses");
    } else router.push(`/dashboard/checkout/${res.orderId}`);
    router.refresh();
  };

  if (!items.length)
    return (
      <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-richblack-600 p-14 text-center">
        <FiShoppingCart className="text-5xl text-richblack-400" />
        <p className="text-xl font-semibold text-richblack-5">Giỏ hàng trống</p>
        <p className="text-richblack-300">Hãy chọn khóa học bạn muốn học.</p>
        <Link href="/catalog" className="rounded-md bg-yellow-50 px-5 py-2 font-semibold text-richblack-900">
          Khám phá khóa học
        </Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <div className="flex-1">
        <p className="mb-2 border-b border-richblack-700 pb-2 text-richblack-300">{items.length} khóa học trong giỏ</p>
        {items.map((i) => (
          <div key={i.courseId} className="flex gap-4 border-b border-richblack-700 py-5">
            <Link href={`/courses/${i.courseId}`} className="shrink-0">
              {i.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.thumbnail} alt="" className="h-[100px] w-[170px] rounded-md object-cover" />
              ) : (
                <div className="grid h-[100px] w-[170px] place-items-center rounded-md bg-richblack-700 text-3xl text-richblack-400"><FiBookOpen /></div>
              )}
            </Link>
            <div className="flex flex-1 flex-col gap-1">
              <Link href={`/courses/${i.courseId}`} className="font-semibold text-richblack-5 hover:text-yellow-50">{i.courseName}</Link>
              <p className="text-sm text-richblack-300">{i.instructor}</p>
              <p className="text-xs text-richblack-400">{i.lectures} bài học</p>
            </div>
            <div className="flex flex-col items-end justify-between">
              <p className="text-lg font-semibold text-yellow-50">{vnd(i.price)}</p>
              <button disabled={busy} onClick={() => remove(i.courseId)} className="flex items-center gap-1 rounded-md bg-richblack-700 px-3 py-2 text-sm text-pink-200">
                <FiTrash2 /> Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-richblack-700 bg-richblack-800 p-6 lg:w-[300px]">
        <p className="text-sm text-richblack-200">Tổng cộng:</p>
        <p className="mb-5 text-3xl font-semibold text-yellow-50">{vnd(total)}</p>
        <button disabled={busy} onClick={checkout} className="w-full rounded-md bg-yellow-50 py-3 font-semibold text-richblack-900 disabled:opacity-50">
          {total === 0 ? "Đăng ký ngay" : "Thanh toán"}
        </button>
        <p className="mt-3 text-xs text-richblack-400">
          Thanh toán bằng chuyển khoản ngân hàng. Khóa học mở ngay sau khi admin xác nhận.
        </p>
      </div>
    </div>
  );
}
