"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiArrowLeft, FiCheckCircle, FiChevronDown, FiChevronLeft, FiChevronRight, FiCircle, FiMenu } from "react-icons/fi";
import VideoFrame from "./VideoFrame";
import ReviewForm from "./ReviewForm";

type Lecture = {
  id: string;
  title: string;
  description: string;
  timeDuration: string;
  embed: { type: "iframe" | "video" | "link"; src: string; watch?: string };
};
type Section = { id: string; name: string; lectures: Lecture[] };

export default function LearnView({
  courseId,
  courseName,
  sections,
  completed: initialCompleted,
  canTrack,
  myReview,
}: {
  courseId: string;
  courseName: string;
  sections: Section[];
  completed: string[];
  canTrack: boolean;
  myReview?: { rating: number; review: string | null } | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const flat = useMemo(() => sections.flatMap((s) => s.lectures), [sections]);
  const [completed, setCompleted] = useState<string[]>(initialCompleted);
  const [sidebar, setSidebar] = useState(true);
  const [closed, setClosed] = useState<string[]>([]);

  const currentId = params.get("lecture") && flat.some((l) => l.id === params.get("lecture"))
    ? params.get("lecture")!
    : flat.find((l) => !initialCompleted.includes(l.id))?.id ?? flat[0]?.id;
  const idx = flat.findIndex((l) => l.id === currentId);
  const current = flat[idx];
  const pct = flat.length ? Math.round((completed.filter((id) => flat.some((l) => l.id === id)).length / flat.length) * 100) : 0;

  const go = (id?: string) => {
    if (!id) return;
    router.replace(`/learn/${courseId}?lecture=${id}`, { scroll: false });
    if (window.innerWidth < 1024) setSidebar(false);
  };

  // ghi lại bài đang xem để lần sau "Tiếp tục học"
  useEffect(() => {
    if (!canTrack || !current) return;
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, lectureId: current.id, visit: true }),
    }).catch(() => {});
  }, [canTrack, courseId, current]);

  const toggleDone = async (id: string, done: boolean) => {
    if (!canTrack) return;
    setCompleted((c) => (done ? Array.from(new Set([...c, id])) : c.filter((x) => x !== id)));
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, lectureId: id, done }),
    }).then((r) => r.json()).catch(() => null);
    if (!res?.success) {
      toast.error("Không lưu được tiến độ");
      return;
    }
    setCompleted(res.completed);
    if (done && res.percent === 100) toast.success("🎉 Chúc mừng! Bạn đã hoàn thành khóa học");
  };

  const completeAndNext = async () => {
    if (!current) return;
    if (!completed.includes(current.id)) await toggleDone(current.id, true);
    go(flat[idx + 1]?.id);
  };

  if (!current)
    return <p className="p-10 text-center text-richblack-300">Khóa học chưa có bài học nào.</p>;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] text-richblack-5">
      {/* Sidebar */}
      {sidebar && (
        <aside className="fixed inset-0 top-14 z-40 w-full overflow-y-auto border-r border-richblack-700 bg-richblack-800 lg:static lg:w-[340px] lg:shrink-0">
          <div className="border-b border-richblack-700 p-5">
            <div className="mb-3 flex items-center justify-between">
              <Link href="/dashboard/enrolled-courses" className="flex items-center gap-1 text-sm text-richblack-300 hover:text-yellow-50">
                <FiArrowLeft /> Khóa học của tôi
              </Link>
              <button onClick={() => setSidebar(false)} className="text-richblack-300 lg:hidden"><FiChevronLeft /></button>
            </div>
            <p className="font-semibold">{courseName}</p>
            <div className="mt-3 h-2 rounded-full bg-richblack-700">
              <div className="h-2 rounded-full bg-yellow-50" style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
            <p className="mt-1 text-xs text-richblack-300">Hoàn thành {pct}%</p>
          </div>
          {sections.map((s) => (
            <div key={s.id} className="border-b border-richblack-700">
              <button
                onClick={() => setClosed((c) => (c.includes(s.id) ? c.filter((x) => x !== s.id) : [...c, s.id]))}
                className="flex w-full items-center justify-between bg-richblack-700 px-5 py-3 text-left text-sm font-semibold"
              >
                {s.name}
                <FiChevronDown className={closed.includes(s.id) ? "-rotate-90" : ""} />
              </button>
              {!closed.includes(s.id) &&
                s.lectures.map((l) => {
                  const done = completed.includes(l.id);
                  const active = l.id === current.id;
                  return (
                    <div key={l.id} className={`flex items-start gap-3 px-5 py-3 text-sm ${active ? "bg-yellow-800 text-yellow-50" : "text-richblack-100 hover:bg-richblack-700"}`}>
                      <button
                        title={done ? "Bỏ đánh dấu" : "Đánh dấu đã học"}
                        onClick={() => toggleDone(l.id, !done)}
                        className="mt-0.5 shrink-0"
                      >
                        {done ? <FiCheckCircle className="text-caribbeangreen-200" /> : <FiCircle className="text-richblack-400" />}
                      </button>
                      <button onClick={() => go(l.id)} className="flex-1 text-left">
                        {l.title}
                        {l.timeDuration && <span className="block text-xs text-richblack-400">{l.timeDuration}</span>}
                      </button>
                    </div>
                  );
                })}
            </div>
          ))}
        </aside>
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1000px] p-4 lg:p-8">
          {!sidebar && (
            <button onClick={() => setSidebar(true)} className="mb-4 flex items-center gap-2 text-sm text-richblack-300">
              <FiMenu /> Danh sách bài học
            </button>
          )}
          <VideoFrame key={current.id} embed={current.embed} title={current.title} />
          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs text-richblack-400">Bài {idx + 1}/{flat.length}</p>
              <h1 className="text-2xl font-semibold">{current.title}</h1>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => go(flat[idx - 1]?.id)} disabled={idx === 0}
                className="flex items-center gap-1 rounded-md bg-richblack-700 px-4 py-2 text-sm disabled:opacity-40">
                <FiChevronLeft /> Trước
              </button>
              {canTrack && (
                <button onClick={completeAndNext}
                  className="flex items-center gap-1 rounded-md bg-yellow-50 px-4 py-2 text-sm font-semibold text-richblack-900">
                  {completed.includes(current.id) ? "Bài tiếp" : "Hoàn thành & tiếp"} <FiChevronRight />
                </button>
              )}
              {!canTrack && (
                <button onClick={() => go(flat[idx + 1]?.id)} disabled={idx === flat.length - 1}
                  className="flex items-center gap-1 rounded-md bg-richblack-700 px-4 py-2 text-sm disabled:opacity-40">
                  Sau <FiChevronRight />
                </button>
              )}
            </div>
          </div>
          {current.description && (
            <p className="mt-6 whitespace-pre-line rounded-md bg-richblack-800 p-5 text-richblack-100">{current.description}</p>
          )}
          {canTrack && (
            <div className="mt-8">
              <h2 className="mb-3 text-lg font-semibold">Đánh giá khóa học</h2>
              <ReviewForm
                key={pct === 100 ? "open" : "locked"}
                courseId={courseId}
                eligible={pct === 100}
                reason={`Hoàn thành tất cả bài học để đánh giá khóa học (hiện tại ${pct}%).`}
                existing={myReview ?? null}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
