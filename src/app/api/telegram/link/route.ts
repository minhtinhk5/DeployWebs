import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User } from "@/database/entity/User.entity";
import { NEXT_AUTH } from "@/services/NextAuth";
import { sendToChat } from "@/services/Telegram";
import { minutesFromNow } from "@/utils/security";
import crypto from "crypto";
import QRCode from "qrcode";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";

async function currentUser() {
  const session = await getServerSession(NEXT_AUTH);
  if (!session?.user?.id) return null;
  await InitializeDatabase();
  return AppDataSource.getRepository(User).findOne({ where: { id: session.user.id } });
}

const unauthorized = () =>
  NextResponse.json({ success: false, message: "Bạn cần đăng nhập" }, { status: 401 });

/** Tạo link kết nối: https://t.me/<bot>?start=<code> (hết hạn sau 10 phút) */
export async function POST() {
  const user = await currentUser();
  if (!user) return unauthorized();

  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (!botUsername) {
    return NextResponse.json({
      success: false,
      message: "Chưa cấu hình TELEGRAM_BOT_USERNAME trên server",
    });
  }

  const code = crypto.randomBytes(16).toString("hex");
  user.telegramLinkCode = code;
  user.telegramLinkCodeExpires = minutesFromNow(10);
  await AppDataSource.getRepository(User).save(user);

  const url = `https://t.me/${botUsername}?start=${code}`;
  const webUrl = `https://web.telegram.org/k/#?tgaddr=${encodeURIComponent(
    `tg://resolve?domain=${botUsername}&start=${code}`
  )}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, width: 200 });

  return NextResponse.json({
    success: true,
    url,
    webUrl,
    code,
    bot: botUsername,
    qr: `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`,
    expiresInSec: 600,
  });
}

/** Hủy liên kết Telegram */
export async function DELETE() {
  const user = await currentUser();
  if (!user) return unauthorized();

  const oldChat = user.telegramChatId;
  user.telegramChatId = null;
  user.telegramUsername = null;
  user.telegramLinkCode = null;
  user.telegramLinkCodeExpires = null;
  await AppDataSource.getRepository(User).save(user);

  void sendToChat(oldChat, "🔌 Tài khoản StudyNotion đã hủy liên kết với Telegram này.");

  return NextResponse.json({ success: true, message: "Đã hủy liên kết Telegram" });
}

/** Bật/tắt cảnh báo đăng nhập */
export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  user.telegramLoginAlert = Boolean(body?.loginAlert);
  await AppDataSource.getRepository(User).save(user);

  return NextResponse.json({ success: true, loginAlert: user.telegramLoginAlert });
}
