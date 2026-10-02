import { bumpCache } from "@/lib/redis";
import { AppDataSource } from "@/database/dataSource";
import { Course, Status } from "@/database/entity/Course.entity";
import { notifyCoursePublished } from "@/lib/courseNotify";
import { parseCourseRequest } from "@/lib/courseRequest";
import { getInstructor, saveCourse } from "@/lib/courses";
import { NextResponse, type NextRequest } from "next/server";

const forbidden = () =>
  NextResponse.json({ success: false, message: "Chỉ giảng viên mới dùng được chức năng này" }, { status: 403 });

/** Danh sách khóa học của giảng viên đang đăng nhập */
export async function GET() {
  const instructor = await getInstructor();
  if (!instructor) return forbidden();

  const courses = await AppDataSource.getRepository(Course).find({
    where: { instructor: { id: instructor.id } },
    relations: ["category", "studentsEnrolled"],
    order: { createdAt: "DESC" },
  });

  return NextResponse.json({
    success: true,
    courses: courses.map((c) => ({
      id: c.id,
      courseName: c.courseName,
      price: c.price,
      status: c.status,
      thumbnail: c.thumbnail,
      category: c.category?.name ?? null,
      students: c.studentsEnrolled?.length ?? 0,
      createdAt: c.createdAt,
    })),
  });
}

/** Tạo khóa học mới */
export async function POST(req: NextRequest) {
  const instructor = await getInstructor();
  if (!instructor) return forbidden();

  const parsed = await parseCourseRequest(req);
  if (!parsed.ok) return NextResponse.json({ success: false, message: parsed.message });

  const { input, thumbnail } = parsed;
  const lectures = input.sections.reduce((n, s) => n + s.lectures.length, 0);

  if (input.status === Status.PUBLIC && lectures === 0) {
    return NextResponse.json({
      success: false,
      message: "Cần ít nhất 1 bài học trước khi xuất bản",
    });
  }

  try {
    const course = new Course();
    course.instructor = instructor;
    const saved = await saveCourse(course, input, thumbnail);

    await bumpCache("courses");
    if (saved.status === Status.PUBLIC) notifyCoursePublished(saved, instructor, lectures);

    return NextResponse.json({ success: true, message: "Đã tạo khóa học", id: saved.id });
  } catch (e) {
    console.error("Create course error", e);
    return NextResponse.json({ success: false, message: "Không lưu được khóa học" });
  }
}
