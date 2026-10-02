import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User } from "@/database/entity/User.entity";
import { otpTemplate } from "@/mails/emailVerificationTemplate";
import mailer from "@/services/Nodemailer";
import { escapeHtml, notifyAdmin, tgTime } from "@/services/Telegram";
import { generateOtp, isExpired, minutesFromNow, safeEqual } from "@/utils/security";
import { rateLimit, resetRateLimit } from "@/utils/rateLimit";
import { NextRequest, NextResponse } from "next/server";

const OTP_TTL_MIN = 10;

const tooMany = (sec: number) =>
  NextResponse.json(
    { success: false, message: `Thử quá nhiều lần, vui lòng đợi ${Math.ceil(sec / 60)} phút` },
    { status: 429 }
  );

/** Xác minh OTP đăng ký */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const otp = String(body?.otp ?? "").trim();

    if (!email || !otp) {
      return NextResponse.json({ success: false, message: "Thiếu email hoặc OTP" });
    }

    const rl = await rateLimit(`otp-verify:${email}`, 5, 15 * 60 * 1000);
    if (!rl.ok) return tooMany(rl.retryAfterSec);

    await InitializeDatabase();
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOne({ where: { email } });

    if (!user) {
      return NextResponse.json({ success: false, message: "User doesn't exist" });
    }

    if (user.isSignedIn) {
      return NextResponse.json({ success: true, message: "Tài khoản đã được xác minh" });
    }

    if (!safeEqual(otp, user.verificationOtp) || isExpired(user.otpExpires)) {
      return NextResponse.json({ success: false, message: "OTP không đúng hoặc đã hết hạn" });
    }

    user.verificationOtp = null;
    user.otpExpires = null;
    user.isSignedIn = true;
    await repo.save(user);
    await resetRateLimit(`otp-verify:${email}`);

    void notifyAdmin(
      `🎉 <b>Người dùng mới đăng ký</b>\n` +
        `👤 ${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}\n` +
        `📧 ${escapeHtml(user.email)}\n` +
        `📱 ${escapeHtml(user.contactNumber)}\n` +
        `🎓 ${escapeHtml(user.accountType)}\n🕒 ${tgTime()}`
    );

    // SỬA: bản cũ trả về cả object user (có hash mật khẩu)
    return NextResponse.json({ success: true, message: "User Signed In successfully" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "Error while trying to SignUp user" });
  }
}

/** Gửi lại OTP */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();

    const rl = await rateLimit(`otp-resend:${email}`, 3, 10 * 60 * 1000);
    if (!rl.ok) return tooMany(rl.retryAfterSec);

    await InitializeDatabase();
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOne({ where: { email } });

    if (!user || user.isSignedIn) {
      return NextResponse.json({ success: false, message: "User dosen't exist." });
    }

    const otp = generateOtp();

    try {
      await mailer(email, "StudyNotion Verification-Email", otpTemplate(otp));
    } catch {
      return NextResponse.json({ success: false, message: "Problem while Emailing OTP" });
    }

    user.verificationOtp = otp;
    user.otpExpires = minutesFromNow(OTP_TTL_MIN);
    await repo.save(user);
    await resetRateLimit(`otp-verify:${email}`);

    // SỬA LỖI BẢO MẬT: bản cũ trả `otp` về trình duyệt => bỏ qua được bước xác minh email
    return NextResponse.json({ success: true, email });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "Problems while resending OTP or SigningIn user",
    });
  }
}
