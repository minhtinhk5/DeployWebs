import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User } from "@/database/entity/User.entity";
import { NEXT_AUTH } from "@/services/NextAuth";
import { escapeHtml, sendToChat, tgTime } from "@/services/Telegram";
import { hashPassword } from "@/utils/security";
import { rateLimit } from "@/utils/rateLimit";
import bcrypt from "bcrypt";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import z from "zod";

const schema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6, "Mật khẩu mới tối thiểu 6 ký tự").max(100),
  confirmNewPassword: z.string(),
});

export const POST = async function (req: NextRequest) {
  // SỬA LỖI BẢO MẬT: bản cũ lấy `id` từ body và không kiểm tra đăng nhập,
  // đồng thời quên `await bcrypt.compare` => ai cũng đổi được mật khẩu của người khác.
  const session = await getServerSession(NEXT_AUTH);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Bạn cần đăng nhập" }, { status: 401 });
  }

  if (!(await rateLimit(`chpw:${session.user.id}`, 5, 15 * 60 * 1000)).ok) {
    return NextResponse.json(
      { success: false, message: "Thử quá nhiều lần, vui lòng đợi 15 phút" },
      { status: 429 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ",
    });
  }

  const { oldPassword, newPassword, confirmNewPassword } = parsed.data;

  if (newPassword !== confirmNewPassword) {
    return NextResponse.json({
      success: false,
      message: "NewPassword and ConfirmNewPassword must be same",
    });
  }

  await InitializeDatabase();
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { id: session.user.id } });

  if (!user) {
    return NextResponse.json({ success: false, message: "Invalid User" });
  }

  if (!(await bcrypt.compare(oldPassword, user.password))) {
    return NextResponse.json({ success: false, message: "Password Incorrect" });
  }

  user.password = await hashPassword(newPassword);
  await repo.save(user);

  void sendToChat(
    user.telegramChatId,
    `🔑 <b>Mật khẩu StudyNotion vừa được thay đổi</b>\n📧 ${escapeHtml(user.email)}\n🕒 ${tgTime()}\n\nNếu không phải bạn, hãy dùng "Quên mật khẩu" ngay.`
  );

  return NextResponse.json({ success: true, message: "Password changed Successfully" });
};
