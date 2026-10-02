import { contactUsEmail } from "@/mails/contactFormRes";
import mailer from "@/services/Nodemailer";
import { escapeHtml, notifyAdmin, tgTime } from "@/services/Telegram";
import { getClientIp } from "@/utils/security";
import { rateLimit } from "@/utils/rateLimit";
import { NextResponse, type NextRequest } from "next/server";
import z from "zod";

const schema = z.object({
  firstname: z.string().trim().min(1, "Vui lòng nhập tên").max(50),
  lastname: z.string().trim().min(1, "Vui lòng nhập họ").max(50),
  email: z.string().trim().toLowerCase().email("Email không hợp lệ"),
  countrycode: z.string().trim().max(10).default(""),
  phonenumber: z.string().trim().min(6, "Số điện thoại không hợp lệ").max(20),
  message: z.string().trim().min(5, "Nội dung quá ngắn").max(2000),
  website: z.string().optional(), // honeypot chống bot spam
});

/**
 * Form liên hệ: gửi thông báo về Telegram admin + email xác nhận cho khách.
 * (Bản cũ form không có action => bấm gửi không làm gì.)
 * Có thể gọi từ web static/PHP khác (bật CORS bằng CONTACT_ALLOWED_ORIGINS).
 */
export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);

  const ip = getClientIp(req.headers);
  const rl = await rateLimit(`contact:${ip}`, 3, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, message: "Bạn gửi quá nhiều, vui lòng thử lại sau ít phút" },
      { status: 429, headers: cors }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400, headers: cors }
    );
  }

  const d = parsed.data;

  // Bot điền honeypot => giả vờ thành công
  if (d.website) {
    return NextResponse.json({ success: true, message: "Đã gửi" }, { headers: cors });
  }

  const source = req.headers.get("origin") || "studynotion";

  const sent = await notifyAdmin(
    `📩 <b>Liên hệ mới</b> (${escapeHtml(source)})\n\n` +
      `👤 <b>${escapeHtml(d.firstname)} ${escapeHtml(d.lastname)}</b>\n` +
      `📧 ${escapeHtml(d.email)}\n` +
      `📱 ${escapeHtml(d.countrycode)} ${escapeHtml(d.phonenumber)}\n\n` +
      `💬 ${escapeHtml(d.message)}\n\n🕒 ${tgTime()}`
  );

  let mailed = false;
  try {
    await mailer(
      d.email,
      "Your Data send successfully",
      contactUsEmail(
        escapeHtml(d.email),
        escapeHtml(d.firstname),
        escapeHtml(d.lastname),
        escapeHtml(d.message),
        escapeHtml(d.phonenumber),
        escapeHtml(d.countrycode)
      )
    );
    mailed = true;
  } catch {
    /* không bắt buộc */
  }

  if (!sent && !mailed) {
    return NextResponse.json(
      { success: false, message: "Không gửi được tin nhắn, vui lòng thử lại sau" },
      { status: 502, headers: cors }
    );
  }

  return NextResponse.json(
    { success: true, message: "Cảm ơn bạn! Chúng tôi sẽ phản hồi sớm." },
    { headers: cors }
  );
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = (process.env.CONTACT_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}
