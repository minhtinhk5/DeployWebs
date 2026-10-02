import BuyBox from "@/components/Student/BuyBox";
import ReviewForm from "@/components/Student/ReviewForm";
import ReviewList, { type ReviewItem } from "@/components/Student/ReviewList";
import { reviewEligibility } from "@/lib/reviews";
import CourseContentList, { type PublicSection } from "@/components/Student/CourseContentList";
import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { CartItem } from "@/database/entity/CartItem.entity";
import { Course, Status } from "@/database/entity/Course.entity";
import { Order, OrderStatus } from "@/database/entity/Order.entity";
import { getSessionUser, isEnrolled, toEmbed, vnd } from "@/lib/student";
import Link from "next/link";
import { FiBookOpen, FiCheck, FiClock, FiGlobe, FiUsers } from "react-icons/fi";

export const dynamic = "force-dynamic";

export default async function CourseDetail({ params }: { params: { id: string } }) {
  await InitializeDatabase();
  const course = await AppDataSource.getRepository(Course).findOne({
    where: { id: params.id },
    relations: ["instructor", "category", "studentsEnrolled", "courseContent", "courseContent.subSection", "ratingsAndReviews", "ratingsAndReviews.user"],
    order: { courseContent: { order: "ASC", subSection: { order: "ASC" } } },
  });

  const user = await getSessionUser();
  const isOwner = Boolean(user && course?.instructor?.id === user.id);

  if (!course || (course.status !== Status.PUBLIC && !isOwner)) {
    return (
      <div className="py-32 text-center text-richblack-5">
        <p className="mb-4 text-2xl font-semibold">Không tìm thấy khóa học</p>
        <Link href="/catalog" className="text-yellow-50 underline">Xem các khóa học khác</Link>
      </div>
    );
  }

  let state: "guest" | "owner" | "enrolled" | "incart" | "none" = "guest";
  let pendingOrderId: string | null = null;
  if (user) {
    if (isOwner) state = "owner";
    else if (await isEnrolled(user.id, course.id)) state = "enrolled";
    else {
      const inCart = await AppDataSource.getRepository(CartItem).count({
        where: { user: { id: user.id }, course: { id: course.id } },
      });
      state = inCart ? "incart" : "none";
      const pending = await AppDataSource.getRepository(Order).find({
        where: { user: { id: user.id }, status: OrderStatus.PENDING },
      });
      pendingOrderId = pending.find((o) => o.items.some((i) => i.courseId === course.id))?.id ?? null;
    }
  }

  const sections: PublicSection[] = (course.courseContent ?? []).map((s) => ({
    id: s.id,
    name: s.sectionName,
    lectures: (s.subSection ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      timeDuration: l.timeDuration,
      preview: l.isPreview ? toEmbed(l.videoUrl) : null,
    })),
  }));
  const lectureCount = sections.reduce((n, s) => n + s.lectures.length, 0);
  const learn = (course.whatYouWillLearn || "")
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  const ratings = course.ratingsAndReviews ?? [];
  const reviewItems: ReviewItem[] = [...ratings]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .map((r) => ({
      id: r.id,
      name: r.user ? `${r.user.firstName} ${r.user.lastName}` : "Học viên",
      image: r.user?.image ?? null,
      rating: r.rating,
      review: r.review,
      date: r.createdAt ? new Date(r.createdAt).toLocaleDateString("vi-VN") : "",
    }));
  const myReview = user ? ratings.find((r) => r.user?.id === user.id) : undefined;
  const eligibility = state === "enrolled" && user ? await reviewEligibility(user.id, course.id) : null;
  const avg = ratings.length ? ratings.reduce((n, r) => n + r.rating, 0) / ratings.length : null;

  return (
    <div className="text-richblack-5">
      {/* Hero */}
      <section className="bg-richblack-800">
        <div className="mx-auto grid w-11/12 max-w-maxContent gap-8 py-12 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-richblack-300">
              <Link href="/catalog" className="hover:text-yellow-50">Khóa học</Link>
              {course.category && <> / <span className="text-yellow-50">{course.category.name}</span></>}
            </p>
            <h1 className="text-3xl font-bold lg:text-4xl">{course.courseName}</h1>
            <p className="whitespace-pre-line text-richblack-200">{course.courseDescription}</p>
            <div className="flex flex-wrap gap-4 text-sm text-richblack-200">
              {avg && <span className="text-yellow-50">★ {avg.toFixed(1)} ({ratings.length} đánh giá)</span>}
              <span className="flex items-center gap-1"><FiUsers /> {course.studentsEnrolled?.length ?? 0} học viên</span>
              <span className="flex items-center gap-1"><FiBookOpen /> {lectureCount} bài học</span>
              <span className="flex items-center gap-1"><FiClock /> Cập nhật {new Date(course.updatedAt ?? course.createdAt).toLocaleDateString("vi-VN")}</span>
              <span className="flex items-center gap-1"><FiGlobe /> Tiếng Việt</span>
            </div>
            <p className="text-sm">
              Giảng viên:{" "}
              <b className="text-yellow-50">
                {course.instructor?.firstName} {course.instructor?.lastName}
              </b>
            </p>
          </div>

          {/* Buy card */}
          <div className="h-fit overflow-hidden rounded-lg border border-richblack-600 bg-richblack-700 lg:row-span-2">
            {course.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.thumbnail} alt="" className="aspect-video w-full object-cover" />
            ) : (
              <div className="grid aspect-video place-items-center bg-richblack-600 text-5xl text-richblack-400"><FiBookOpen /></div>
            )}
            <div className="flex flex-col gap-4 p-6">
              <p className="text-3xl font-bold">{vnd(course.price)}</p>
              <BuyBox courseId={course.id} price={Number(course.price)} state={state} pendingOrderId={pendingOrderId} />
              {(course.instructions ?? []).filter(Boolean).length > 0 && (
                <div>
                  <p className="mb-2 font-semibold">Yêu cầu:</p>
                  <ul className="flex flex-col gap-1 text-sm text-caribbeangreen-100">
                    {(course.instructions ?? []).filter(Boolean).map((r, i) => (
                      <li key={i} className="flex gap-2"><FiCheck className="mt-1 shrink-0" /> {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-11/12 max-w-maxContent py-12 lg:pr-[420px]">
        {learn.length > 0 && (
          <section className="mb-10 rounded-md border border-richblack-600 p-6">
            <h2 className="mb-4 text-2xl font-semibold">Bạn sẽ học được</h2>
            <ul className="grid gap-2 md:grid-cols-2">
              {learn.map((l, i) => (
                <li key={i} className="flex gap-2 text-richblack-100"><FiCheck className="mt-1 shrink-0 text-yellow-50" /> {l}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-10">
          <h2 className="mb-2 text-2xl font-semibold">Nội dung khóa học</h2>
          <p className="mb-4 text-sm text-richblack-300">{sections.length} chương • {lectureCount} bài học</p>
          {sections.length ? <CourseContentList sections={sections} /> : <p className="text-richblack-300">Nội dung đang được cập nhật.</p>}
        </section>

        <section id="reviews" className="mb-10 scroll-mt-20">
          <h2 className="mb-4 text-2xl font-semibold">Đánh giá của học viên</h2>
          {eligibility && (
            <div className="mb-6">
              <ReviewForm
                courseId={course.id}
                eligible={eligibility.ok}
                reason={eligibility.ok ? undefined : eligibility.reason}
                existing={myReview ? { rating: myReview.rating, review: myReview.review } : null}
              />
            </div>
          )}
          <ReviewList reviews={reviewItems} />
        </section>

        {(course.tag ?? []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(course.tag ?? []).map((t) => (
              <Link key={t} href={`/catalog?q=${encodeURIComponent(t)}`} className="rounded-full bg-richblack-700 px-3 py-1 text-sm text-richblack-100">
                #{t}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
