/**
 * API nội bộ cho bot Telegram gọi vào (chỉ 127.0.0.1, xác thực bằng TELEGRAM_API_KEY).
 *   POST /api/telegram/internal/link    { code, chatId, username }
 *   POST /api/telegram/internal/me      { chatId }
 *   POST /api/telegram/internal/unlink  { chatId }
 *   POST /api/telegram/internal/stats   {}
 */
import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User } from "@/database/entity/User.entity";
import { Course } from "@/database/entity/Course.entity";
import { Order, OrderStatus } from "@/database/entity/Order.entity";
import { decideOrder, vnd } from "@/lib/student";
import { isFromBot } from "@/services/Telegram";
import { isExpired } from "@/utils/security";
import { MoreThan } from "typeorm";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest, { params }: { params: { action: string } }) {
  if (!isFromBot(req)) return fail("forbidden", 403);

  const body = await req.json().catch(() => ({}));
  const chatId = body?.chatId != null ? String(body.chatId) : "";

  await InitializeDatabase();
  const repo = AppDataSource.getRepository(User);

  switch (params.action) {
    case "link": {
      const code = String(body?.code ?? "");
      if (!/^[a-f0-9]{32}$/.test(code) || !chatId) return fail("invalid_code");

      const user = await repo.findOne({ where: { telegramLinkCode: code } });
      if (!user || isExpired(user.telegramLinkCodeExpires)) return fail("invalid_code");

      // Một chat chỉ gắn với một tài khoản
      const other = await repo.findOne({ where: { telegramChatId: chatId } });
      if (other && other.id !== user.id) {
        other.telegramChatId = null;
        other.telegramUsername = null;
        await repo.save(other);
      }

      user.telegramChatId = chatId;
      user.telegramUsername = body?.username ? String(body.username).slice(0, 64) : null;
      user.telegramLinkCode = null;
      user.telegramLinkCodeExpires = null;
      await repo.save(user);

      return NextResponse.json({
        ok: true,
        user: { name: `${user.firstName} ${user.lastName}`, email: user.email },
      });
    }

    case "me": {
      if (!chatId) return fail("missing_chat");
      const user = await repo.findOne({
        where: { telegramChatId: chatId },
        relations: ["courses"],
      });
      if (!user) return NextResponse.json({ ok: true, linked: false });

      return NextResponse.json({
        ok: true,
        linked: true,
        user: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          accountType: user.accountType,
          contactNumber: user.contactNumber,
          createdAt: user.createdAt,
          enrolledCourses: user.courses?.length ?? 0,
          loginAlert: user.telegramLoginAlert,
        },
      });
    }

    case "unlink": {
      if (!chatId) return fail("missing_chat");
      const user = await repo.findOne({ where: { telegramChatId: chatId } });
      if (!user) return NextResponse.json({ ok: true, unlinked: false });
      user.telegramChatId = null;
      user.telegramUsername = null;
      await repo.save(user);
      return NextResponse.json({ ok: true, unlinked: true });
    }

    case "alert": {
      // bật/tắt cảnh báo đăng nhập từ bot: { chatId, on: boolean }
      const user = await repo.findOne({ where: { telegramChatId: chatId } });
      if (!user) return NextResponse.json({ ok: true, linked: false });
      user.telegramLoginAlert = Boolean(body?.on);
      await repo.save(user);
      return NextResponse.json({ ok: true, linked: true, loginAlert: user.telegramLoginAlert });
    }

    case "stats": {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [total, verified, students, instructors, new24h, telegramLinked] =
        await Promise.all([
          repo.count(),
          repo.count({ where: { isSignedIn: true } }),
          repo.count({ where: { accountType: "Student" as User["accountType"] } }),
          repo.count({ where: { accountType: "Instructor" as User["accountType"] } }),
          repo.count({ where: { createdAt: MoreThan(since) } }),
          repo
            .createQueryBuilder("u")
            .where("u.telegramChatId IS NOT NULL")
            .getCount(),
        ]);

      const courseRepo = AppDataSource.getRepository(Course);
      const [courses, coursesPublic] = await Promise.all([
        courseRepo.count(),
        courseRepo.count({ where: { status: "Public" as Course["status"] } }),
      ]);

      return NextResponse.json({
        ok: true,
        stats: { total, verified, students, instructors, new24h, telegramLinked, courses, coursesPublic },
      });
    }

    case "courses": {
      // Khóa học của giảng viên đã liên kết chat này
      const user = await repo.findOne({ where: { telegramChatId: chatId } });
      if (!user) return NextResponse.json({ ok: true, linked: false });
      const list = await AppDataSource.getRepository(Course).find({
        where: { instructor: { id: user.id } },
        relations: ["studentsEnrolled"],
        order: { createdAt: "DESC" },
        take: 20,
      });
      return NextResponse.json({
        ok: true,
        linked: true,
        isInstructor: user.accountType !== "Student",
        courses: list.map((c) => ({
          name: c.courseName,
          status: c.status,
          price: Number(c.price),
          students: c.studentsEnrolled?.length ?? 0,
        })),
      });
    }

    case "order": {
      // Admin bấm nút duyệt trong Telegram: { orderId, approve: boolean }
      const r = await decideOrder(String(body?.orderId ?? ""), Boolean(body?.approve));
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error, code: r.order?.code });
      return NextResponse.json({
        ok: true,
        code: r.order.code,
        status: r.order.status,
        student: r.order.user.email,
        amount: vnd(r.order.amount),
      });
    }

    case "orders": {
      // Danh sách đơn đang chờ
      const list = await AppDataSource.getRepository(Order).find({
        where: { status: OrderStatus.PENDING },
        relations: ["user"],
        order: { createdAt: "DESC" },
        take: 10,
      });
      return NextResponse.json({
        ok: true,
        orders: list.map((o) => ({
          id: o.id,
          code: o.code,
          email: o.user?.email,
          amount: vnd(o.amount),
          items: o.items.map((i) => i.name),
          createdAt: o.createdAt,
        })),
      });
    }

    default:
      return fail("unknown_action", 404);
  }
}
