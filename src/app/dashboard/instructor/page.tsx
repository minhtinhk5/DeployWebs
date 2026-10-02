import NotInstructor from "@/components/Dashboard/courses/NotInstructor";
import { AppDataSource } from "@/database/dataSource";
import { Course } from "@/database/entity/Course.entity";
import { getInstructor } from "@/lib/courses";
import Link from "next/link";
import { FiBookOpen, FiDollarSign, FiPlus, FiStar, FiUsers } from "react-icons/fi";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bảng điều khiển | StudyNotion" };

const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} ₫`;

export default async function InstructorDashboard() {
  const instructor = await getInstructor();
  if (!instructor) return <NotInstructor />;

  const courses = await AppDataSource.getRepository(Course).find({
    where: { instructor: { id: instructor.id } },
    relations: ["studentsEnrolled", "ratingsAndReviews", "ratingsAndReviews.user", "courseContent", "courseContent.subSection"],
    order: { createdAt: "DESC" },
  });

  const rows = courses.map((c) => {
    const students = c.studentsEnrolled?.length ?? 0;
    const ratings = c.ratingsAndReviews ?? [];
    return {
      id: c.id,
      name: c.courseName,
      status: c.status,
      thumbnail: c.thumbnail,
      students,
      revenue: students * Number(c.price),
      lectures: (c.courseContent ?? []).reduce((n, s) => n + (s.subSection?.length ?? 0), 0),
      rating: ratings.length ? ratings.reduce((n, r) => n + r.rating, 0) / ratings.length : null,
      reviews: ratings.length,
    };
  });

  const totalStudents = rows.reduce((n, r) => n + r.students, 0);
  const totalRevenue = rows.reduce((n, r) => n + r.revenue, 0);
  const published = rows.filter((r) => r.status === "Public").length;
  const allRatings = courses.flatMap((c) => c.ratingsAndReviews ?? []);
  const avgRating = allRatings.length
    ? allRatings.reduce((n, r) => n + r.rating, 0) / allRatings.length
    : null;
  const recentReviews = courses
    .flatMap((c) => (c.ratingsAndReviews ?? []).map((r) => ({ r, course: c.courseName })))
    .sort((a, b) => new Date(b.r.createdAt ?? 0).getTime() - new Date(a.r.createdAt ?? 0).getTime())
    .slice(0, 5);
  const maxStudents = Math.max(1, ...rows.map((r) => r.students));

  const stats = [
    { label: "Khóa học", value: `${rows.length}`, sub: `${published} đã xuất bản`, icon: FiBookOpen },
    { label: "Học viên", value: totalStudents.toLocaleString("vi-VN"), sub: "tổng lượt đăng ký", icon: FiUsers },
    { label: "Doanh thu ước tính", value: vnd(totalRevenue), sub: "giá × học viên", icon: FiDollarSign },
    {
      label: "Đánh giá",
      value: avgRating ? avgRating.toFixed(1) : "—",
      sub: `${allRatings.length} lượt đánh giá`,
      icon: FiStar,
    },
  ];

  return (
    <div className="text-richblack-5">
      <h1 className="text-3xl font-medium">Xin chào {instructor.firstName} 👋</h1>
      <p className="mb-10 mt-1 text-richblack-300">Tổng quan hoạt động giảng dạy của bạn.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-md border border-richblack-700 bg-richblack-800 p-5">
            <div className="mb-3 flex items-center justify-between text-richblack-300">
              <span className="text-sm">{s.label}</span>
              <s.icon className="text-lg text-yellow-50" />
            </div>
            <p className="text-2xl font-semibold">{s.value}</p>
            <p className="mt-1 text-xs text-richblack-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-md border border-dashed border-richblack-600 p-12 text-center">
          <p className="text-xl font-semibold">Bạn chưa có khóa học nào</p>
          <p className="text-richblack-300">Tạo khóa học đầu tiên để bắt đầu có học viên.</p>
          <Link
            href="/dashboard/add-course"
            className="flex items-center gap-2 rounded-md bg-yellow-50 px-5 py-2 font-semibold text-richblack-900"
          >
            <FiPlus /> Tạo khóa học
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-md border border-richblack-700 bg-richblack-800 p-6">
            <h2 className="mb-5 text-lg font-semibold">Học viên theo khóa học</h2>
            <div className="flex flex-col gap-4">
              {rows.slice(0, 8).map((r) => (
                <div key={r.id}>
                  <div className="mb-1 flex justify-between gap-4 text-sm">
                    <span className="truncate text-richblack-100">{r.name}</span>
                    <span className="shrink-0 text-richblack-300">{r.students}</span>
                  </div>
                  <div className="h-2 rounded-full bg-richblack-700">
                    <div
                      className="h-2 rounded-full bg-yellow-50"
                      style={{ width: `${Math.max(2, (r.students / maxStudents) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-richblack-700 bg-richblack-800 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Khóa học gần đây</h2>
              <Link href="/dashboard/my-courses" className="text-sm text-yellow-50">
                Xem tất cả
              </Link>
            </div>
            <div className="flex flex-col gap-4">
              {rows.slice(0, 4).map((r) => (
                <Link
                  key={r.id}
                  href={`/dashboard/edit-course/${r.id}`}
                  className="flex items-center gap-3 rounded-md p-1 hover:bg-richblack-700"
                >
                  {r.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbnail} alt="" className="h-12 w-20 rounded object-cover" />
                  ) : (
                    <div className="grid h-12 w-20 place-items-center rounded bg-richblack-700 text-richblack-400">
                      <FiBookOpen />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    <p className="text-xs text-richblack-400">
                      {r.status === "Public" ? "Đã xuất bản" : "Bản nháp"} • {r.lectures} bài •{" "}
                      {r.students} học viên
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-richblack-700 bg-richblack-800 p-6 lg:col-span-2">
            <h2 className="mb-5 text-lg font-semibold">Đánh giá gần đây</h2>
            {recentReviews.length === 0 ? (
              <p className="text-sm text-richblack-300">Chưa có đánh giá. Học viên hoàn thành khóa học mới có thể đánh giá.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-richblack-700">
                {recentReviews.map(({ r, course }) => (
                  <li key={r.id} className="py-3">
                    <p className="text-sm">
                      <span className="text-yellow-50">{"★".repeat(Math.round(r.rating))}</span>
                      <span className="text-richblack-500">{"★".repeat(5 - Math.round(r.rating))}</span>
                      <span className="ml-2 font-semibold">{r.user?.firstName} {r.user?.lastName}</span>
                      <span className="text-richblack-400"> · {course}</span>
                    </p>
                    {r.review && <p className="mt-1 text-sm text-richblack-100">{r.review}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
