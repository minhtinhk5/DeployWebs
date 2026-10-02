import { bumpCache } from "@/lib/redis";
import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User } from "@/database/entity/User.entity";
import { Course, Status } from "@/database/entity/Course.entity";
import { CartItem } from "@/database/entity/CartItem.entity";
import { CourseProgress } from "@/database/entity/CourseProgress.entity";
import { Order, OrderStatus } from "@/database/entity/Order.entity";
import { NEXT_AUTH } from "@/services/NextAuth";
import { escapeHtml, notifyAdmin, sendToChat, tgTime } from "@/services/Telegram";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { In } from "typeorm";

export const vnd = (n: number) =>
  Number(n) === 0 ? "Miễn phí" : `${Math.round(Number(n)).toLocaleString("vi-VN")} ₫`;

export async function getSessionUser() {
  const session = await getServerSession(NEXT_AUTH);
  if (!session?.user?.id) return null;
  await InitializeDatabase();
  return AppDataSource.getRepository(User).findOne({ where: { id: session.user.id } });
}

/** id các khóa học user đã đăng ký */
export async function enrolledCourseIds(userId: string): Promise<string[]> {
  await InitializeDatabase();
  const rows: { id: string }[] = await AppDataSource.createQueryBuilder()
    .relation(User, "courses")
    .of(userId)
    .loadMany();
  return rows.map((r) => r.id);
}

export async function isEnrolled(userId: string, courseId: string) {
  return (await enrolledCourseIds(userId)).includes(courseId);
}

export async function cartCount(userId: string) {
  await InitializeDatabase();
  return AppDataSource.getRepository(CartItem).count({ where: { user: { id: userId } } });
}

/** Ghi danh user vào các khóa học (bỏ qua khóa đã có) và xóa khỏi giỏ */
export async function enroll(userId: string, courseIds: string[]) {
  const already = await enrolledCourseIds(userId);
  const toAdd = courseIds.filter((id) => !already.includes(id));
  if (toAdd.length) {
    await AppDataSource.createQueryBuilder().relation(User, "courses").of(userId).add(toAdd);
    await bumpCache("courses");
  }
  if (courseIds.length) {
    await AppDataSource.getRepository(CartItem).delete({
      user: { id: userId },
      course: { id: In(courseIds) },
    });
  }
  return toAdd;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newOrderCode = () =>
  "SN" + Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");

/** Tạo đơn chờ thanh toán + báo admin qua Telegram (có nút duyệt) */
export async function createOrder(user: User, courses: Course[]) {
  const repo = AppDataSource.getRepository(Order);
  const order = repo.create({
    code: newOrderCode(),
    user,
    items: courses.map((c) => ({ courseId: c.id, name: c.courseName, price: Number(c.price) })),
    amount: courses.reduce((n, c) => n + Number(c.price), 0),
    status: OrderStatus.PENDING,
  });
  const saved = await repo.save(order);

  void notifyAdmin(
    `🛒 <b>Đơn hàng mới ${saved.code}</b>\n\n` +
      `👤 ${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)} (${escapeHtml(user.email)})\n` +
      saved.items.map((i) => `• ${escapeHtml(i.name)} — ${vnd(i.price)}`).join("\n") +
      `\n\n💰 Tổng: <b>${vnd(saved.amount)}</b>\n` +
      `📝 Nội dung CK: <code>${saved.code}</code>\n🕒 ${tgTime()}\n\n` +
      `Kiểm tra tài khoản ngân hàng rồi bấm nút bên dưới.`,
    [
      [
        { text: "✅ Đã nhận tiền", data: `order:approve:${saved.id}` },
        { text: "❌ Từ chối", data: `order:reject:${saved.id}` },
      ],
    ]
  );
  return saved;
}

/** Admin duyệt / từ chối đơn */
export async function decideOrder(orderId: string, approve: boolean) {
  await InitializeDatabase();
  const repo = AppDataSource.getRepository(Order);
  const order = await repo.findOne({ where: { id: orderId }, relations: ["user"] });
  if (!order) return { ok: false as const, error: "not_found" };
  if (order.status !== OrderStatus.PENDING) {
    return { ok: false as const, error: `already_${order.status.toLowerCase()}`, order };
  }

  order.status = approve ? OrderStatus.PAID : OrderStatus.REJECTED;
  order.paidAt = approve ? new Date() : null;
  await repo.save(order);

  if (approve) {
    await enroll(order.user.id, order.items.map((i) => i.courseId));
    void sendToChat(
      order.user.telegramChatId,
      `🎉 Thanh toán đơn <b>${order.code}</b> đã được xác nhận!\n\n` +
        order.items.map((i) => `📚 ${escapeHtml(i.name)}`).join("\n") +
        `\n\nVào <b>Enrolled Courses</b> trên web để bắt đầu học.`
    );
    await notifyInstructors(order.user, order.items.map((i) => i.courseId));
  } else {
    void sendToChat(
      order.user.telegramChatId,
      `❌ Đơn <b>${order.code}</b> chưa được xác nhận thanh toán. Vui lòng liên hệ hỗ trợ nếu bạn đã chuyển khoản.`
    );
  }
  return { ok: true as const, order };
}

/** Báo giảng viên có học viên mới */
export async function notifyInstructors(student: User, courseIds: string[]) {
  if (!courseIds.length) return;
  const courses = await AppDataSource.getRepository(Course).find({
    where: { id: In(courseIds) },
    relations: ["instructor"],
  });
  for (const c of courses) {
    void sendToChat(
      c.instructor?.telegramChatId,
      `👨‍🎓 Học viên mới <b>${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</b> ` +
        `vừa đăng ký khóa <b>${escapeHtml(c.courseName)}</b>.`
    );
  }
}

/** Các khóa học đã xuất bản theo id */
export async function publishedCourses(ids: string[]) {
  if (!ids.length) return [];
  return AppDataSource.getRepository(Course).find({
    where: { id: In(ids), status: Status.PUBLIC },
  });
}

/** Tiến độ học: { courseId -> { done, total, lastLectureId } } */
export async function progressFor(userId: string, courses: Course[]) {
  const rows = await AppDataSource.getRepository(CourseProgress).find({
    where: { user: { id: userId }, courseId: In(courses.map((c) => c.id).concat("-")) },
  });
  const map: Record<string, { done: number; total: number; lastLectureId: string | null }> = {};
  for (const c of courses) {
    const lectureIds = (c.courseContent ?? []).flatMap((s) => (s.subSection ?? []).map((l) => l.id));
    const p = rows.find((r) => r.courseId === c.id);
    const done = (p?.completedLectures ?? []).filter((id) => lectureIds.includes(id)).length;
    map[c.id] = { done, total: lectureIds.length, lastLectureId: p?.lastLectureId ?? null };
  }
  return map;
}

/** Chuyển link video sang dạng nhúng */
export function toEmbed(url: string): { type: "iframe" | "video" | "link"; src: string; watch?: string } {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^(www\.|m\.)/, "");
    let ytId: string | null = null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (u.searchParams.get("v")) ytId = u.searchParams.get("v");
      else if (["embed", "shorts", "live", "v"].includes(parts[0]) && parts[1]) ytId = parts[1];
    } else if (host === "youtu.be") {
      ytId = u.pathname.split("/").filter(Boolean)[0] ?? null;
    }
    if (ytId && /^[\w-]{6,20}$/.test(ytId)) {
      const t = u.searchParams.get("t") || u.searchParams.get("start");
      const start = t ? parseInt(t, 10) : 0;
      return {
        type: "iframe",
        src: `https://www.youtube.com/embed/${ytId}?rel=0${start ? `&start=${start}` : ""}`,
        watch: `https://www.youtube.com/watch?v=${ytId}`,
      };
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return { type: "iframe", src: `https://player.vimeo.com/video/${id}`, watch: url };
    }
    if (host === "drive.google.com") {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      const id = m?.[1] || u.searchParams.get("id");
      if (id) return { type: "iframe", src: `https://drive.google.com/file/d/${id}/preview`, watch: url };
    }
    if (/\.(mp4|webm|ogg|m3u8)$/i.test(u.pathname) || host.endsWith("cloudinary.com")) {
      return { type: "video", src: url };
    }
  } catch {
    /* url không hợp lệ */
  }
  return { type: "link", src: url };
}

/** Thông tin chuyển khoản (cấu hình trong .env) */
export function paymentInfo(amount: number, code: string) {
  const bank = process.env.VIETQR_BANK || ""; // VD: VCB, MB, TCB, ACB...
  const account = process.env.VIETQR_ACCOUNT || "";
  const name = process.env.VIETQR_NAME || "";
  const qr =
    bank && account
      ? `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(
          account
        )}-compact2.png?amount=${Math.round(amount)}&addInfo=${encodeURIComponent(
          code
        )}&accountName=${encodeURIComponent(name)}`
      : null;
  return {
    bank,
    account,
    name,
    qr,
    note: process.env.PAYMENT_NOTE || "",
  };
}
