import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { RatingsAndReviews } from "@/database/entity/RatingsAndReviews.entity";
import Link from "next/link";
import { MoreThanOrEqual } from "typeorm";
import { unstable_noStore as noStore } from "next/cache";

/** Đánh giá thật từ học viên (4★ trở lên, có nội dung) */
export default async function ReviewSlider() {
  noStore(); // luôn lấy đánh giá mới nhất, không build tĩnh
  let reviews: RatingsAndReviews[] = [];
  try {
    await InitializeDatabase();
    reviews = await AppDataSource.getRepository(RatingsAndReviews).find({
      where: { rating: MoreThanOrEqual(4) },
      relations: ["user", "course"],
      order: { createdAt: "DESC" },
      take: 12,
    });
  } catch {
    /* DB lỗi thì không hiển thị */
  }
  reviews = reviews.filter((r) => r.review && r.user && r.course);

  if (!reviews.length)
    return <p className="text-center text-richblack-300">Chưa có đánh giá nào — hãy là người đầu tiên!</p>;

  return (
    <section className="w-full overflow-x-auto pb-4">
      <div className="flex w-max gap-5">
        {reviews.map((r) => (
          <div key={r.id} className="flex w-[300px] flex-col gap-3 rounded-lg bg-richblack-800 p-5 text-left">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.user.image} alt="" className="h-10 w-10 rounded-full object-cover" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-richblack-5">{r.user.firstName} {r.user.lastName}</p>
                <Link href={`/courses/${r.course.id}`} className="block truncate text-xs text-richblack-400 hover:text-yellow-50">
                  {r.course.courseName}
                </Link>
              </div>
            </div>
            <p className="line-clamp-4 text-sm text-richblack-25">{r.review}</p>
            <p className="mt-auto text-yellow-50">
              {r.rating.toFixed(1)} {"★".repeat(Math.round(r.rating))}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
