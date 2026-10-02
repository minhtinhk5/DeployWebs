import { AppDataSource } from "@/database/dataSource";
import { CartItem } from "@/database/entity/CartItem.entity";
import { Order, OrderStatus } from "@/database/entity/Order.entity";
import {
  createOrder,
  enroll,
  enrolledCourseIds,
  getSessionUser,
  notifyInstructors,
  publishedCourses,
} from "@/lib/student";
import { escapeHtml, notifyAdmin, tgTime } from "@/services/Telegram";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Thanh toán. Body: { courseIds?: string[] } (mặc định: toàn bộ giỏ hàng)
 * - Tổng = 0 (khóa miễn phí): ghi danh ngay.
 * - Tổng > 0: tạo đơn chờ chuyển khoản, admin xác nhận qua Telegram.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, message: "Bạn cần đăng nhập" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let ids: string[] = Array.isArray(body?.courseIds) ? body.courseIds.map(String) : [];

  if (!ids.length) {
    const cart = await AppDataSource.getRepository(CartItem).find({
      where: { user: { id: user.id } },
      relations: ["course"],
    });
    ids = cart.map((c) => c.course.id);
  }

  const owned = await enrolledCourseIds(user.id);
  const courses = (await publishedCourses(ids)).filter((c) => !owned.includes(c.id));
  if (!courses.length) {
    return NextResponse.json({ success: false, message: "Không có khóa học nào cần thanh toán" });
  }

  // Tránh tạo trùng đơn đang chờ cho cùng các khóa
  const pending = await AppDataSource.getRepository(Order).find({
    where: { user: { id: user.id }, status: OrderStatus.PENDING },
  });
  const same = pending.find(
    (o) =>
      o.items.length === courses.length && courses.every((c) => o.items.some((i) => i.courseId === c.id))
  );
  if (same) return NextResponse.json({ success: true, orderId: same.id, message: "Bạn đã có đơn đang chờ" });

  const free = courses.filter((c) => Number(c.price) === 0);
  const paid = courses.filter((c) => Number(c.price) > 0);

  if (free.length) {
    const added = await enroll(user.id, free.map((c) => c.id));
    if (added.length) {
      void notifyAdmin(
        `🎓 <b>Đăng ký khóa miễn phí</b>\n👤 ${escapeHtml(user.email)}\n` +
          free.map((c) => `• ${escapeHtml(c.courseName)}`).join("\n") +
          `\n🕒 ${tgTime()}`
      );
      await notifyInstructors(user, added);
    }
  }

  if (!paid.length) {
    return NextResponse.json({ success: true, enrolled: true, message: "Đăng ký thành công!" });
  }

  const order = await createOrder(user, paid);
  return NextResponse.json({
    success: true,
    orderId: order.id,
    enrolledFree: free.length,
    message: "Đã tạo đơn hàng, vui lòng chuyển khoản",
  });
}
