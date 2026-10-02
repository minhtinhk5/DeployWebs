import { AppDataSource } from "@/database/dataSource";
import { CartItem } from "@/database/entity/CartItem.entity";
import { Course, Status } from "@/database/entity/Course.entity";
import { cartCount, getSessionUser, isEnrolled } from "@/lib/student";
import { NextResponse, type NextRequest } from "next/server";

const unauthorized = () =>
  NextResponse.json({ success: false, message: "Bạn cần đăng nhập" }, { status: 401 });

/** Thêm vào giỏ: { courseId } */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { courseId } = await req.json().catch(() => ({}));
  const course = await AppDataSource.getRepository(Course).findOne({
    where: { id: String(courseId ?? ""), status: Status.PUBLIC },
    relations: ["instructor"],
  });
  if (!course) return NextResponse.json({ success: false, message: "Khóa học không tồn tại" });
  if (course.instructor?.id === user.id)
    return NextResponse.json({ success: false, message: "Đây là khóa học của bạn" });
  if (await isEnrolled(user.id, course.id))
    return NextResponse.json({ success: false, message: "Bạn đã đăng ký khóa học này" });

  const repo = AppDataSource.getRepository(CartItem);
  const exists = await repo.findOne({ where: { user: { id: user.id }, course: { id: course.id } } });
  if (!exists) await repo.save(repo.create({ user, course }));

  return NextResponse.json({
    success: true,
    message: exists ? "Khóa học đã có trong giỏ" : "Đã thêm vào giỏ hàng",
    count: await cartCount(user.id),
  });
}

/** Xóa khỏi giỏ: { courseId } */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { courseId } = await req.json().catch(() => ({}));
  await AppDataSource.getRepository(CartItem).delete({
    user: { id: user.id },
    course: { id: String(courseId ?? "") },
  });
  return NextResponse.json({ success: true, message: "Đã xóa khỏi giỏ", count: await cartCount(user.id) });
}
