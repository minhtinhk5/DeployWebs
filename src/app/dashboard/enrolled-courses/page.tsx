import { AppDataSource } from "@/database/dataSource";
import { Course } from "@/database/entity/Course.entity";
import { Order, OrderStatus } from "@/database/entity/Order.entity";
import { RatingsAndReviews } from "@/database/entity/RatingsAndReviews.entity";
import { enrolledCourseIds, getSessionUser, progressFor, vnd } from "@/lib/student";
import Link from "next/link";
import { In } from "typeorm";
import { FiBookOpen } from "react-icons/fi";

export const dynamic = "force-dynamic";
export const metadata = { title: "Khóa học đã đăng ký | StudyNotion" };

const TABS = [
  { key: "all", label: "Tất cả" },
  { key: "progress", label: "Đang học" },
  { key: "done", label: "Hoàn thành" },
];

export default async function EnrolledCourses({ searchParams }: { searchParams: { tab?: string } }) {
  const user = await getSessionUser();
  if (!user) return null;
  const tab = searchParams.tab ?? "all";

  const ids = await enrolledCourseIds(user.id);
  const courses = ids.length
    ? await AppDataSource.getRepository(Course).find({
        where: { id: In(ids) },
        relations: ["instructor", "courseContent", "courseContent.subSection"],
      })
    : [];
  const progress = await progressFor(user.id, courses);
  const pending = await AppDataSource.getRepository(Order).find({
    where: { user: { id: user.id }, status: OrderStatus.PENDING },
    order: { createdAt: "DESC" },
  });

  const reviewed = (
    await AppDataSource.getRepository(RatingsAndReviews).find({
      where: { user: { id: user.id } },
      relations: ["course"],
    })
  ).map((r) => r.course?.id);

  const rows = courses
    .map((c) => {
      const p = progress[c.id];
      const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
      return { c, p, pct };
    })
    .filter(({ pct }) => (tab === "done" ? pct === 100 : tab === "progress" ? pct < 100 : true));

  return (
    <div className="text-richblack-5">
      <h1 className="mb-8 text-3xl font-medium">Khóa học đã đăng ký</h1>

      {pending.length > 0 && (
        <div className="mb-8 flex flex-col gap-2">
          {pending.map((o) => (
            <Link key={o.id} href={`/dashboard/checkout/${o.id}`} className="flex items-center justify-between gap-3 rounded-md border border-yellow-50 bg-richblack-800 px-5 py-3 text-sm">
              <span>⏳ Đơn <b>{o.code}</b> ({o.items.map((i) => i.name).join(", ")}) đang chờ xác nhận thanh toán</span>
              <span className="shrink-0 text-yellow-50">{vnd(o.amount)} →</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-6 flex w-fit gap-1 rounded-full bg-richblack-800 p-1">
        {TABS.map((t) => (
          <Link key={t.key} href={`/dashboard/enrolled-courses${t.key === "all" ? "" : `?tab=${t.key}`}`}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === t.key ? "bg-richblack-900 text-richblack-5" : "text-richblack-300"}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-richblack-600 p-14 text-center">
          <FiBookOpen className="text-5xl text-richblack-400" />
          <p className="text-xl font-semibold">Bạn chưa đăng ký khóa học nào</p>
          <Link href="/catalog" className="rounded-md bg-yellow-50 px-5 py-2 font-semibold text-richblack-900">Khám phá khóa học</Link>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-richblack-600 p-10 text-center text-richblack-300">Không có khóa học nào trong mục này.</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-richblack-700">
          <div className="hidden grid-cols-[1fr_200px_140px] gap-4 bg-richblack-800 px-6 py-3 text-xs uppercase text-richblack-100 md:grid">
            <span>Khóa học</span><span>Tiến độ</span><span />
          </div>
          {rows.map(({ c, p, pct }) => (
            <div key={c.id} className="grid gap-4 border-t border-richblack-700 px-4 py-5 md:grid-cols-[1fr_200px_140px] md:items-center md:px-6">
              <div className="flex gap-4">
                {c.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumbnail} alt="" className="h-[60px] w-[100px] shrink-0 rounded object-cover" />
                ) : (
                  <div className="grid h-[60px] w-[100px] shrink-0 place-items-center rounded bg-richblack-700 text-richblack-400"><FiBookOpen /></div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.courseName}</p>
                  <p className="text-sm text-richblack-300">{c.instructor?.firstName} {c.instructor?.lastName}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-richblack-200">{pct === 100 ? "Hoàn thành 🎉" : `${pct}%`} <span className="text-richblack-400">({p.done}/{p.total} bài)</span></p>
                <div className="h-2 rounded-full bg-richblack-700">
                  <div className={`h-2 rounded-full ${pct === 100 ? "bg-caribbeangreen-300" : "bg-yellow-50"}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Link href={`/learn/${c.id}${p.lastLectureId ? `?lecture=${p.lastLectureId}` : ""}`}
                  className="rounded-md bg-yellow-50 px-4 py-2 text-center text-sm font-semibold text-richblack-900">
                  {p.done === 0 ? "Bắt đầu học" : pct === 100 ? "Xem lại" : "Tiếp tục học"}
                </Link>
                {pct === 100 && (
                  <Link href={`/courses/${c.id}#reviews`} className="rounded-md border border-yellow-50 px-4 py-1.5 text-center text-sm text-yellow-50">
                    {reviewed.includes(c.id) ? "⭐ Sửa đánh giá" : "⭐ Đánh giá"}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
