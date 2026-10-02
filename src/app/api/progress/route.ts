import { AppDataSource } from "@/database/dataSource";
import { Course } from "@/database/entity/Course.entity";
import { CourseProgress } from "@/database/entity/CourseProgress.entity";
import { getSessionUser, isEnrolled } from "@/lib/student";
import { NextResponse, type NextRequest } from "next/server";

/** Đánh dấu bài học: { courseId, lectureId, done?: boolean, visit?: boolean } */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false }, { status: 401 });

  const { courseId, lectureId, done, visit } = await req.json().catch(() => ({}));
  if (!courseId || !lectureId) return NextResponse.json({ success: false, message: "Thiếu dữ liệu" });
  if (!(await isEnrolled(user.id, String(courseId))))
    return NextResponse.json({ success: false, message: "Bạn chưa đăng ký khóa học" }, { status: 403 });

  const course = await AppDataSource.getRepository(Course).findOne({
    where: { id: String(courseId) },
    relations: ["courseContent", "courseContent.subSection"],
  });
  const lectureIds = (course?.courseContent ?? []).flatMap((s) => (s.subSection ?? []).map((l) => l.id));
  if (!lectureIds.includes(String(lectureId)))
    return NextResponse.json({ success: false, message: "Bài học không tồn tại" });

  const repo = AppDataSource.getRepository(CourseProgress);
  let p = await repo.findOne({ where: { user: { id: user.id }, courseId: String(courseId) } });
  if (!p) p = repo.create({ user, courseId: String(courseId), completedLectures: [] });

  const set = new Set(p.completedLectures ?? []);
  if (!visit) {
    if (done === false) set.delete(String(lectureId));
    else set.add(String(lectureId));
  }
  p.completedLectures = Array.from(set);
  p.lastLectureId = String(lectureId);
  await repo.save(p);

  const doneCount = p.completedLectures.filter((id) => lectureIds.includes(id)).length;
  return NextResponse.json({
    success: true,
    completed: p.completedLectures,
    percent: lectureIds.length ? Math.round((doneCount / lectureIds.length) * 100) : 0,
  });
}
