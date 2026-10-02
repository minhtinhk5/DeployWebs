import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User } from "@/database/entity/User.entity";
import { Profile } from "@/database/entity/Profile.entity";
import { RatingsAndReviews } from "@/database/entity/RatingsAndReviews.entity";
import { CourseProgress } from "@/database/entity/CourseProgress.entity";
import { NEXT_AUTH } from "@/services/NextAuth";
import { escapeHtml, notifyAdmin, sendToChat, tgTime } from "@/services/Telegram";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Xóa tài khoản (bản cũ nút "Delete account" không làm gì).
 * Body: { confirmEmail } - phải gõ đúng email để xác nhận.
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(NEXT_AUTH);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  await InitializeDatabase();
  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: session.user.id },
    relations: ["additionalInformation", "uploadedCourses", "courses"],
  });

  if (!user) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  }

  if (String(body?.confirmEmail ?? "").trim().toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ success: false, message: "Email xác nhận không khớp" });
  }

  if (user.uploadedCourses?.length) {
    return NextResponse.json({
      success: false,
      message: "Tài khoản đang có khóa học đã đăng, hãy xóa khóa học trước",
    });
  }

  try {
    await AppDataSource.transaction(async (m) => {
      await m
        .createQueryBuilder()
        .delete()
        .from(RatingsAndReviews)
        .where("userId = :id", { id: user.id })
        .execute();
      await m
        .createQueryBuilder()
        .delete()
        .from(CourseProgress)
        .where("userId = :id", { id: user.id })
        .execute();
      if (user.courses?.length) {
        await m
          .createQueryBuilder()
          .relation(User, "courses")
          .of(user.id)
          .remove(user.courses.map((c) => c.id));
      }
      await m.delete(User, { id: user.id });
      if (user.additionalInformation?.id) {
        await m.delete(Profile, { id: user.additionalInformation.id });
      }
    });
  } catch (error) {
    console.error("Delete account error", error);
    return NextResponse.json({ success: false, message: "Không xóa được tài khoản, thử lại sau" });
  }

  void sendToChat(user.telegramChatId, "🗑 Tài khoản StudyNotion của bạn đã bị xóa.");
  void notifyAdmin(
    `🗑 <b>Tài khoản bị xóa</b>\n📧 ${escapeHtml(user.email)}\n🕒 ${tgTime()}`
  );

  return NextResponse.json({ success: true, message: "Đã xóa tài khoản" });
}
