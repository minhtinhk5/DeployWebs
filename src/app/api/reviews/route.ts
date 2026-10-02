import { bumpCache } from "@/lib/redis";
import { AppDataSource } from "@/database/dataSource";
import { Course } from "@/database/entity/Course.entity";
import { RatingsAndReviews } from "@/database/entity/RatingsAndReviews.entity";
import { reviewEligibility, stars } from "@/lib/reviews";
import { getSessionUser } from "@/lib/student";
import { escapeHtml, sendToChat } from "@/services/Telegram";
import { NextResponse, type NextRequest } from "next/server";
import z from "zod";

const schema = z.object({
  courseId: z.string().uuid(),
  rating: z.coerce.number().int().min(1, "Chọn số sao").max(5),
  review: z.string().trim().max(2000).optional().default(""),
});

const unauthorized = () =>
  NextResponse.json({ success: false, message: "Bạn cần đăng nhập" }, { status: 401 });

/** Gửi hoặc sửa đánh giá */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" });
  const { courseId, rating, review } = parsed.data;

  const eligible = await reviewEligibility(user.id, courseId);
  if (!eligible.ok) return NextResponse.json({ success: false, message: eligible.reason }, { status: 403 });

  const repo = AppDataSource.getRepository(RatingsAndReviews);
  let r = await repo.findOne({ where: { user: { id: user.id }, course: { id: courseId } } });
  const isNew = !r;
  if (!r) r = repo.create({ user, course: { id: courseId } as Course });
  r.rating = rating;
  r.review = review || null;
  await repo.save(r);
  await bumpCache("courses");

  if (isNew) {
    const course = await AppDataSource.getRepository(Course).findOne({
      where: { id: courseId },
      relations: ["instructor"],
    });
    void sendToChat(
      course?.instructor?.telegramChatId,
      `⭐ <b>Đánh giá mới</b> cho khóa <b>${escapeHtml(course?.courseName)}</b>\n` +
        `${stars(rating)} (${rating}/5) — ${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}` +
        (review ? `\n\n💬 ${escapeHtml(review)}` : "")
    );
  }

  return NextResponse.json({ success: true, message: isNew ? "Cảm ơn bạn đã đánh giá!" : "Đã cập nhật đánh giá" });
}

/** Xóa đánh giá của mình: { courseId } */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { courseId } = await req.json().catch(() => ({}));
  await AppDataSource.getRepository(RatingsAndReviews).delete({
    user: { id: user.id },
    course: { id: String(courseId ?? "") },
  });
  await bumpCache("courses");
  return NextResponse.json({ success: true, message: "Đã xóa đánh giá" });
}
