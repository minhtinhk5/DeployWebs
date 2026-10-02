import type { Course } from "@/database/entity/Course.entity";
import type { User } from "@/database/entity/User.entity";
import { escapeHtml, notifyAdmin, sendToChat, tgTime } from "@/services/Telegram";
import { formatPrice } from "@/lib/courses";

/** Báo Telegram khi khóa học được xuất bản */
export function notifyCoursePublished(course: Course, instructor: User, lectures: number) {
  const site = process.env.NEXTAUTH_URL || "";
  void notifyAdmin(
    `📚 <b>Khóa học mới được xuất bản</b>\n\n` +
      `🎓 <b>${escapeHtml(course.courseName)}</b>\n` +
      `👨‍🏫 ${escapeHtml(instructor.firstName)} ${escapeHtml(instructor.lastName)} (${escapeHtml(instructor.email)})\n` +
      `💰 ${escapeHtml(formatPrice(course.price))}\n` +
      `🎬 ${lectures} bài học\n🕒 ${tgTime()}` +
      (site ? `\n\n${escapeHtml(site)}/dashboard/my-courses` : "")
  );
  void sendToChat(
    instructor.telegramChatId,
    `✅ Khóa học <b>${escapeHtml(course.courseName)}</b> của bạn đã được xuất bản.`
  );
}
