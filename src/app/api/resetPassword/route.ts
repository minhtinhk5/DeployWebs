import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User } from "@/database/entity/User.entity";
import { tokenTemplate } from "@/mails/passwordUpdateEmail";
import mailer from "@/services/Nodemailer";
import { escapeHtml, sendToChat, tgTime } from "@/services/Telegram";
import { generateOtp, getClientIp, hashPassword, isExpired, minutesFromNow, safeEqual } from "@/utils/security";
import { rateLimit, resetRateLimit } from "@/utils/rateLimit";
import { NextResponse, type NextRequest } from "next/server";
import z from "zod";

const TOKEN_TTL_MIN = 10;

const tooMany = (sec: number) =>
  NextResponse.json(
    { success: false, message: `Thử quá nhiều lần, vui lòng đợi ${Math.ceil(sec / 60)} phút` },
    { status: 429 }
  );

/** Gửi mã khôi phục qua Email (+ Telegram nếu đã liên kết) */
export const POST = async function (req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!z.string().email().safeParse(email).success) {
    return NextResponse.json({ success: false, message: "Email không hợp lệ" });
  }

  const ip = getClientIp(req.headers);
  const rl1 = await rateLimit(`reset-req:${email}`, 3, 15 * 60 * 1000);
  const rl2 = await rateLimit(`reset-req-ip:${ip}`, 10, 15 * 60 * 1000);
  if (!rl1.ok || !rl2.ok) return tooMany(Math.max(rl1.retryAfterSec, rl2.retryAfterSec));

  await InitializeDatabase();
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { email } });

  if (!user) {
    return NextResponse.json({ success: false, message: "Invalid User" });
  }

  const token = generateOtp();
  user.token = token;
  user.tokenExpires = minutesFromNow(TOKEN_TTL_MIN);

  let sentMail = false;
  try {
    await mailer(email, "Password Reset Email", tokenTemplate(token));
    sentMail = true;
  } catch {
    /* thử gửi Telegram bên dưới */
  }

  const sentTg = await sendToChat(
    user.telegramChatId,
    `🔑 <b>Mã khôi phục mật khẩu StudyNotion</b>\n\nMã của bạn: <code>${token}</code>\nHết hạn sau ${TOKEN_TTL_MIN} phút.\n\nNếu bạn không yêu cầu, hãy bỏ qua tin nhắn này.`
  );

  if (!sentMail && !sentTg) {
    return NextResponse.json({
      success: false,
      message: "Error sending Verification mail to the Provided Email",
    });
  }

  await repo.save(user);
  await resetRateLimit(`reset-verify:${email}`);

  return NextResponse.json({
    success: true,
    message: sentTg
      ? "Mã xác minh đã gửi qua Email và Telegram"
      : "Check Email for a Verification Token",
  });
};

const resetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự").max(100),
  confirmPassword: z.string(),
  token: z.string().trim().min(1),
});

/** Đặt lại mật khẩu bằng mã */
export const PUT = async function (req: NextRequest) {
  const parsed = resetSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid Inputs",
    });
  }

  const { email, password, confirmPassword, token } = parsed.data;
  if (password !== confirmPassword) {
    return NextResponse.json({ success: false, message: "Invalid Inputs" });
  }

  // Chống dò mã 6 số
  const rl = await rateLimit(`reset-verify:${email}`, 5, 15 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  await InitializeDatabase();
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { email } });

  if (!user || !safeEqual(token, user.token) || isExpired(user.tokenExpires)) {
    return NextResponse.json({
      success: false,
      message: "Mã không đúng hoặc đã hết hạn",
    });
  }

  user.password = await hashPassword(password);
  user.token = null;
  user.tokenExpires = null;
  await repo.save(user);
  await resetRateLimit(`reset-verify:${email}`);

  void sendToChat(
    user.telegramChatId,
    `✅ <b>Mật khẩu StudyNotion đã được đặt lại</b>\n📧 ${escapeHtml(user.email)}\n🕒 ${tgTime()}`
  );

  return NextResponse.json({ success: true, message: "Password Reset Successfull" });
};
