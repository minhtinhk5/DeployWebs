/**
 * Web KHÔNG giữ bot token. Mọi tin nhắn đi qua service bot (/opt/tgbot)
 * chạy tại 127.0.0.1:3100 và được bảo vệ bằng TELEGRAM_API_KEY.
 */
import { escapeHtml, safeEqual } from "@/utils/security";
import type { NextRequest } from "next/server";

const BOT_URL = process.env.TELEGRAM_BOT_URL || "http://127.0.0.1:3100";

async function callBot(path: string, body: Record<string, unknown>) {
  const apiKey = process.env.TELEGRAM_API_KEY;
  if (!apiKey) {
    console.warn("[telegram] TELEGRAM_API_KEY chưa cấu hình, bỏ qua gửi tin");
    return false;
  }

  try {
    const res = await fetch(`${BOT_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      console.warn(`[telegram] ${path} thất bại:`, data?.error || res.status);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`[telegram] không gọi được bot service (${BOT_URL}):`, (error as Error).message);
    return false;
  }
}

/** Gửi thông báo cho admin (ADMIN_CHAT_ID cấu hình ở bot) */
export type TgButton = { text: string; data?: string; url?: string };
export const notifyAdmin = (html: string, buttons?: TgButton[][]) =>
  callBot("/notify", { text: html, parse_mode: "HTML", ...(buttons ? { buttons } : {}) });

/** Gửi tin cho 1 chat cụ thể (người dùng đã liên kết) */
export const sendToChat = (chatId: string | null | undefined, html: string) => {
  if (!chatId) return Promise.resolve(false);
  return callBot("/send", { chatId, text: html, parse_mode: "HTML" });
};

/** Kiểm tra request đến từ bot service */
export const isFromBot = (req: NextRequest) =>
  safeEqual(req.headers.get("x-api-key"), process.env.TELEGRAM_API_KEY);

export const tgTime = () =>
  new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export { escapeHtml };
