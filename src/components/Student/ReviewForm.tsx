"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { FiLock } from "react-icons/fi";

const LABELS = ["", "Rất tệ", "Chưa tốt", "Bình thường", "Tốt", "Tuyệt vời"];

export default function ReviewForm({
  courseId,
  eligible,
  reason,
  existing,
}: {
  courseId: string;
  eligible: boolean;
  reason?: string;
  existing?: { rating: number; review: string | null } | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState(existing?.review ?? "");
  const [editing, setEditing] = useState(!existing);
  const [busy, setBusy] = useState(false);

  if (!eligible)
    return (
      <div className="flex items-center gap-3 rounded-md border border-dashed border-richblack-600 p-5 text-sm text-richblack-300">
        <FiLock className="shrink-0 text-lg" />
        <span>{reason || "Hoàn thành khóa học để đánh giá."}</span>
      </div>
    );

  const submit = async () => {
    if (!rating) return toast.error("Hãy chọn số sao");
    setBusy(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, rating, review: text }),
    }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!res?.success) return toast.error(res?.message || "Lỗi");
    toast.success(res.message);
    setEditing(false);
    router.refresh();
  };

  const remove = async () => {
    if (!confirm("Xóa đánh giá của bạn?")) return;
    setBusy(true);
    const res = await fetch("/api/reviews", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!res?.success) return toast.error("Lỗi");
    toast.success(res.message);
    setRating(0);
    setText("");
    setEditing(true);
    router.refresh();
  };

  if (!editing && existing)
    return (
      <div className="rounded-md border border-richblack-600 bg-richblack-800 p-5">
        <p className="mb-1 text-sm text-richblack-300">Đánh giá của bạn</p>
        <p className="text-xl text-yellow-50">
          {"★".repeat(rating)}
          <span className="text-richblack-500">{"★".repeat(5 - rating)}</span>
        </p>
        {text && <p className="mt-2 whitespace-pre-line text-richblack-100">{text}</p>}
        <div className="mt-3 flex gap-4 text-sm">
          <button onClick={() => setEditing(true)} className="text-yellow-50 underline">Sửa</button>
          <button onClick={remove} disabled={busy} className="text-pink-200 underline">Xóa</button>
        </div>
      </div>
    );

  return (
    <div className="rounded-md border border-yellow-50/40 bg-richblack-800 p-5">
      <p className="mb-3 font-semibold text-richblack-5">
        {existing ? "Sửa đánh giá" : "🎉 Bạn đã hoàn thành khóa học! Hãy đánh giá nhé"}
      </p>
      <div className="flex items-center gap-3">
        <div className="flex text-3xl" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} sao`}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className={(hover || rating) >= n ? "text-yellow-50" : "text-richblack-500"}
            >
              ★
            </button>
          ))}
        </div>
        <span className="text-sm text-richblack-300">{LABELS[hover || rating]}</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Chia sẻ cảm nhận của bạn về khóa học (không bắt buộc)"
        className="form-style mt-3 w-full"
      />
      <div className="mt-3 flex gap-3">
        <button onClick={submit} disabled={busy} className="rounded-md bg-yellow-50 px-5 py-2 font-semibold text-richblack-900 disabled:opacity-50">
          {existing ? "Lưu" : "Gửi đánh giá"}
        </button>
        {existing && (
          <button onClick={() => setEditing(false)} className="rounded-md bg-richblack-700 px-5 py-2 text-richblack-50">Hủy</button>
        )}
      </div>
    </div>
  );
}
