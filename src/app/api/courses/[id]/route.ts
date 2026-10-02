import { bumpCache } from "@/lib/redis";
import { AppDataSource } from "@/database/dataSource";
import { Course, Status } from "@/database/entity/Course.entity";
import { notifyCoursePublished } from "@/lib/courseNotify";
import { parseCourseRequest } from "@/lib/courseRequest";
import { courseToInput, getInstructor, getOwnedCourse, saveCourse } from "@/lib/courses";
import { NextResponse, type NextRequest } from "next/server";

type Ctx = { params: { id: string } };

const forbidden = () =>
  NextResponse.json({ success: false, message: "Chỉ giảng viên mới dùng được chức năng này" }, { status: 403 });
const notFound = () =>
  NextResponse.json({ success: false, message: "Không tìm thấy khóa học" }, { status: 404 });

const countLectures = (c: Course) =>
  (c.courseContent ?? []).reduce((n, s) => n + (s.subSection?.length ?? 0), 0);

export async function GET(_req: NextRequest, { params }: Ctx) {
  const instructor = await getInstructor();
  if (!instructor) return forbidden();
  const course = await getOwnedCourse(params.id, instructor.id, true);
  if (!course) return notFound();
  return NextResponse.json({ success: true, course: courseToInput(course) });
}

/** Cập nhật toàn bộ khóa học (thông tin + nội dung) */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const instructor = await getInstructor();
  if (!instructor) return forbidden();
  const course = await getOwnedCourse(params.id, instructor.id);
  if (!course) return notFound();

  const parsed = await parseCourseRequest(req);
  if (!parsed.ok) return NextResponse.json({ success: false, message: parsed.message });

  const lectures = parsed.input.sections.reduce((n, s) => n + s.lectures.length, 0);
  if (parsed.input.status === Status.PUBLIC && lectures === 0) {
    return NextResponse.json({ success: false, message: "Cần ít nhất 1 bài học trước khi xuất bản" });
  }

  const wasPublic = course.status === Status.PUBLIC;
  try {
    const saved = await saveCourse(course, parsed.input, parsed.thumbnail);
    await bumpCache("courses");
    if (!wasPublic && saved.status === Status.PUBLIC) {
      notifyCoursePublished(saved, instructor, lectures);
    }
    return NextResponse.json({ success: true, message: "Đã lưu khóa học", id: saved.id });
  } catch (e) {
    console.error("Update course error", e);
    return NextResponse.json({ success: false, message: "Không lưu được khóa học" });
  }
}

/** Đổi trạng thái nhanh: { status: "Draft" | "Public" } */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const instructor = await getInstructor();
  if (!instructor) return forbidden();
  const course = await getOwnedCourse(params.id, instructor.id, true);
  if (!course) return notFound();

  const body = await req.json().catch(() => ({}));
  const status = body?.status === Status.PUBLIC ? Status.PUBLIC : Status.DRAFT;
  const lectures = countLectures(course);

  if (status === Status.PUBLIC && lectures === 0) {
    return NextResponse.json({ success: false, message: "Cần ít nhất 1 bài học trước khi xuất bản" });
  }

  const wasPublic = course.status === Status.PUBLIC;
  await AppDataSource.getRepository(Course).update(course.id, { status });
  await bumpCache("courses");

  if (!wasPublic && status === Status.PUBLIC) {
    notifyCoursePublished({ ...course, status } as Course, instructor, lectures);
  }

  return NextResponse.json({
    success: true,
    status,
    message: status === Status.PUBLIC ? "Đã xuất bản" : "Đã chuyển về bản nháp",
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const instructor = await getInstructor();
  if (!instructor) return forbidden();
  const course = await getOwnedCourse(params.id, instructor.id, true);
  if (!course) return notFound();

  if ((course.studentsEnrolled?.length ?? 0) > 0) {
    return NextResponse.json({
      success: false,
      message: "Khóa học đã có học viên đăng ký, không thể xóa. Hãy chuyển về bản nháp.",
    });
  }

  try {
    await AppDataSource.getRepository(Course).delete(course.id);
    await bumpCache("courses");
  } catch (e) {
    console.error("Delete course error", e);
    return NextResponse.json({ success: false, message: "Không xóa được khóa học" });
  }
  return NextResponse.json({ success: true, message: "Đã xóa khóa học" });
}
