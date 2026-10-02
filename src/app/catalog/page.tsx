import CourseCard, { type CourseCardData } from "@/components/Student/CourseCard";
import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { Category } from "@/database/entity/Category.entity";
import { Course, Status } from "@/database/entity/Course.entity";
import Link from "next/link";
import { cacheVersion, cached } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const metadata = { title: "Khóa học | StudyNotion" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; sort?: string };
}) {
  await InitializeDatabase();
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const cat = searchParams.category ?? "";
  const sort = searchParams.sort ?? "new";

  // Dữ liệu catalog được cache trong Redis 5 phút; tự làm mới khi khóa học/đánh giá thay đổi
  const ver = await cacheVersion("courses");
  const { courses, categories } = await cached(`catalog:v${ver}`, 300, async () => {
    const [rows, cats] = await Promise.all([
      AppDataSource.getRepository(Course).find({
        where: { status: Status.PUBLIC },
        relations: ["instructor", "category", "studentsEnrolled", "courseContent", "courseContent.subSection", "ratingsAndReviews"],
        order: { createdAt: "DESC" },
      }),
      AppDataSource.getRepository(Category).find({ order: { name: "ASC" } }),
    ]);
    return {
      categories: cats.map((c) => ({ id: c.id, name: c.name })),
      courses: rows.map((c) => ({
        categoryId: c.category?.id ?? null,
        tags: c.tag ?? [],
        card: {
          id: c.id,
          courseName: c.courseName,
          thumbnail: c.thumbnail ?? null,
          price: Number(c.price),
          instructor: c.instructor ? `${c.instructor.firstName} ${c.instructor.lastName}` : "",
          category: c.category?.name ?? null,
          students: c.studentsEnrolled?.length ?? 0,
          lectures: (c.courseContent ?? []).reduce((n, s) => n + (s.subSection?.length ?? 0), 0),
          rating: c.ratingsAndReviews?.length
            ? c.ratingsAndReviews.reduce((n, r) => n + r.rating, 0) / c.ratingsAndReviews.length
            : null,
          reviews: c.ratingsAndReviews?.length ?? 0,
        } as CourseCardData,
      })),
    };
  });

  let list: CourseCardData[] = courses
    .filter((c) => !cat || c.categoryId === cat)
    .filter(
      (c) =>
        !q ||
        c.card.courseName.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    )
    .map((c) => c.card);

  if (sort === "popular") list = [...list].sort((a, b) => b.students - a.students);
  if (sort === "rating") list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  if (sort === "price") list = [...list].sort((a, b) => a.price - b.price);

  const usedCats = categories.filter((c) => courses.some((k) => k.categoryId === c.id));
  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(cat && { category: cat }), ...(sort !== "new" && { sort }), ...patch });
    for (const [k, v] of Array.from(p.entries())) if (!v) p.delete(k);
    const s = p.toString();
    return `/catalog${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto w-11/12 max-w-maxContent py-12 text-richblack-5">
      <h1 className="text-3xl font-semibold">Khóa học</h1>
      <p className="mt-2 text-richblack-300">Khám phá {courses.length} khóa học từ các giảng viên của StudyNotion.</p>

      <form action="/catalog" className="mt-8 flex flex-col gap-3 md:flex-row">
        {cat && <input type="hidden" name="category" value={cat} />}
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Tìm theo tên, chủ đề..." className="form-style flex-1" />
        <select name="sort" defaultValue={sort} className="form-style md:w-48">
          <option value="new">Mới nhất</option>
          <option value="popular">Nhiều học viên</option>
          <option value="price">Giá thấp → cao</option>
          <option value="rating">Đánh giá cao</option>
        </select>
        <button className="rounded-md bg-yellow-50 px-6 py-2 font-semibold text-richblack-900">Tìm</button>
      </form>

      {usedCats.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={link({ category: "" })} className={`rounded-full px-4 py-1.5 text-sm ${!cat ? "bg-yellow-50 text-richblack-900" : "bg-richblack-800 text-richblack-200"}`}>
            Tất cả
          </Link>
          {usedCats.map((c) => (
            <Link key={c.id} href={link({ category: c.id })} className={`rounded-full px-4 py-1.5 text-sm ${cat === c.id ? "bg-yellow-50 text-richblack-900" : "bg-richblack-800 text-richblack-200"}`}>
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div className="mt-12 rounded-md border border-dashed border-richblack-600 p-12 text-center text-richblack-300">
          {courses.length === 0 ? "Chưa có khóa học nào được xuất bản." : "Không tìm thấy khóa học phù hợp."}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((c) => <CourseCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}
