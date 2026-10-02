"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiClock, FiEdit2, FiEye, FiEyeOff, FiImage, FiTrash2, FiUsers } from "react-icons/fi";
import { HiCheckCircle } from "react-icons/hi";

export type CourseRow = {
  id: string;
  courseName: string;
  courseDescription: string;
  price: number;
  status: "Draft" | "Public";
  thumbnail: string | null;
  category: string | null;
  students: number;
  lectures: number;
  createdAt: string;
};

const FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "Public", label: "Đã xuất bản" },
  { key: "Draft", label: "Bản nháp" },
] as const;

const price = (p: number) => (Number(p) === 0 ? "Miễn phí" : `${Number(p).toLocaleString("vi-VN")} ₫`);

export default function CourseTable({ courses }: { courses: CourseRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CourseRow | null>(null);

  const list = useMemo(
    () =>
      courses.filter(
        (c) =>
          (filter === "all" || c.status === filter) &&
          c.courseName.toLowerCase().includes(q.trim().toLowerCase())
      ),
    [courses, filter, q]
  );

  const toggleStatus = async (c: CourseRow) => {
    setBusyId(c.id);
    const status = c.status === "Public" ? "Draft" : "Public";
    const res = await fetch(`/api/courses/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setBusyId(null);
    if (!res?.success) return toast.error(res?.message || "Lỗi");
    toast.success(res.message);
    router.refresh();
  };

  const remove = async (c: CourseRow) => {
    setBusyId(c.id);
    const res = await fetch(`/api/courses/${c.id}`, { method: "DELETE" })
      .then((r) => r.json())
      .catch(() => null);
    setBusyId(null);
    setConfirmDelete(null);
    if (!res?.success) return toast.error(res?.message || "Lỗi");
    toast.success(res.message);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-fit gap-1 rounded-full bg-richblack-800 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm ${
                filter === f.key ? "bg-richblack-900 text-richblack-5" : "text-richblack-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm khóa học..."
          className="form-style md:w-64"
        />
      </div>

      {list.length === 0 ? (
        <div className="rounded-md border border-dashed border-richblack-600 p-10 text-center text-richblack-300">
          {courses.length === 0 ? (
            <>
              Bạn chưa có khóa học nào.{" "}
              <Link href="/dashboard/add-course" className="font-semibold text-yellow-50">
                Tạo khóa học đầu tiên →
              </Link>
            </>
          ) : (
            "Không có khóa học phù hợp."
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-richblack-700">
          <div className="hidden grid-cols-[1fr_110px_90px_130px] gap-4 border-b border-richblack-700 bg-richblack-800 px-6 py-3 text-xs uppercase text-richblack-100 md:grid">
            <span>Khóa học</span>
            <span>Giá</span>
            <span>Học viên</span>
            <span className="text-right">Thao tác</span>
          </div>
          {list.map((c) => (
            <div
              key={c.id}
              className="grid gap-4 border-b border-richblack-700 px-4 py-5 last:border-b-0 md:grid-cols-[1fr_110px_90px_130px] md:items-center md:px-6"
            >
              <div className="flex gap-4">
                {c.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumbnail} alt="" className="h-[90px] w-[150px] shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="grid h-[90px] w-[150px] shrink-0 place-items-center rounded-md bg-richblack-700 text-richblack-400">
                    <FiImage className="text-2xl" />
                  </div>
                )}
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate font-semibold text-richblack-5">{c.courseName}</p>
                  <p className="line-clamp-2 text-xs text-richblack-300">{c.courseDescription}</p>
                  <p className="text-xs text-richblack-400">
                    {c.category ?? "Chưa phân loại"} • {c.lectures} bài học •{" "}
                    {new Date(c.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                  {c.status === "Public" ? (
                    <span className="flex w-fit items-center gap-1 rounded-full bg-richblack-700 px-2 py-0.5 text-xs text-yellow-50">
                      <HiCheckCircle /> Đã xuất bản
                    </span>
                  ) : (
                    <span className="flex w-fit items-center gap-1 rounded-full bg-richblack-700 px-2 py-0.5 text-xs text-pink-100">
                      <FiClock /> Bản nháp
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-richblack-100">{price(c.price)}</p>
              <p className="flex items-center gap-1 text-sm text-richblack-100">
                <FiUsers /> {c.students}
              </p>
              <div className="flex gap-4 text-lg text-richblack-300 md:justify-end">
                <button
                  title={c.status === "Public" ? "Chuyển về nháp" : "Xuất bản"}
                  disabled={busyId === c.id}
                  onClick={() => toggleStatus(c)}
                  className="hover:text-yellow-50 disabled:opacity-40"
                >
                  {c.status === "Public" ? <FiEyeOff /> : <FiEye />}
                </button>
                <Link href={`/dashboard/edit-course/${c.id}`} title="Sửa" className="hover:text-caribbeangreen-300">
                  <FiEdit2 />
                </Link>
                <button
                  title="Xóa"
                  disabled={busyId === c.id}
                  onClick={() => setConfirmDelete(c)}
                  className="hover:text-pink-200 disabled:opacity-40"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-white bg-opacity-10 backdrop-blur-sm">
          <div className="w-11/12 max-w-[380px] rounded-lg border border-richblack-400 bg-richblack-800 p-6">
            <p className="text-2xl font-semibold text-richblack-5">Xóa khóa học?</p>
            <p className="mt-3 mb-5 text-richblack-200">
              &quot;{confirmDelete.courseName}&quot; và toàn bộ chương, bài học sẽ bị xóa vĩnh viễn.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => remove(confirmDelete)}
                disabled={busyId === confirmDelete.id}
                className="rounded-md bg-pink-600 px-5 py-2 font-semibold text-white disabled:opacity-50"
              >
                Xóa
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-md bg-richblack-200 px-5 py-2 font-semibold text-richblack-900"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
