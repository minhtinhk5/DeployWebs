import { AppDataSource } from "@/database/dataSource";
import { Course } from "@/database/entity/Course.entity";
import { CourseProgress } from "@/database/entity/CourseProgress.entity";
import { isEnrolled } from "@/lib/student";

/**
 * Điều kiện đánh giá: đã đăng ký khóa học VÀ hoàn thành 100% bài học.
 * Trả về lý do nếu chưa đủ điều kiện.
 */
export async function reviewEligibility(userId: string, courseId: string) {
  if (!(await isEnrolled(userId, courseId))) {
    return { ok: false as const, reason: "Bạn cần đăng ký khóa học trước khi đánh giá" };
  }
  const course = await AppDataSource.getRepository(Course).findOne({
    where: { id: courseId },
    relations: ["courseContent", "courseContent.subSection"],
  });
  const lectureIds = (course?.courseContent ?? []).flatMap((s) => (s.subSection ?? []).map((l) => l.id));
  if (!lectureIds.length) return { ok: false as const, reason: "Khóa học chưa có bài học" };

  const p = await AppDataSource.getRepository(CourseProgress).findOne({
    where: { user: { id: userId }, courseId },
  });
  const done = (p?.completedLectures ?? []).filter((id) => lectureIds.includes(id)).length;
  if (done < lectureIds.length) {
    return {
      ok: false as const,
      reason: `Hoàn thành tất cả bài học để đánh giá (${done}/${lectureIds.length})`,
      done,
      total: lectureIds.length,
    };
  }
  return { ok: true as const, done, total: lectureIds.length };
}

export const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
