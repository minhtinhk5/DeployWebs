import crypto from "crypto";
import bcrypt from "bcrypt";

/** OTP 6 chữ số, dùng crypto thay cho Math.random (không đoán được) */
export const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

export const hashPassword = (password: string) => {
  const rounds = Number(process.env.BCRYPT_ROUNDS) || 10;
  return bcrypt.hash(password, rounds);
};

/** Escape HTML để chèn dữ liệu người dùng vào email / tin nhắn Telegram (parse_mode HTML) */
export const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** So sánh chuỗi bí mật với thời gian không đổi */
export const safeEqual = (a?: string | null, b?: string | null) => {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

export const minutesFromNow = (minutes: number) =>
  new Date(Date.now() + minutes * 60 * 1000);

export const isExpired = (date?: Date | string | null) =>
  !date || new Date(date).getTime() < Date.now();

/** Lấy IP client (nginx cần gửi X-Forwarded-For / X-Real-IP) */
export const getClientIp = (headers: Headers) =>
  headers.get("x-real-ip") ||
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "unknown";

/** Bỏ các trường nhạy cảm trước khi trả user về client */
export const toPublicUser = (user: any) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  image: user.image,
  accountType: user.accountType,
  contactNumber: user.contactNumber,
  additionalInformation: user.additionalInformation ?? null,
  telegram: {
    linked: Boolean(user.telegramChatId),
    username: user.telegramUsername ?? null,
    loginAlert: user.telegramLoginAlert ?? true,
  },
});
