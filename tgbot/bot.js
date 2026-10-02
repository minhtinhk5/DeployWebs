require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const { Bot, GrammyError, HttpError, InlineKeyboard } = require("grammy");

// ================== Cấu hình ==================
const {
  BOT_TOKEN,
  API_KEY,
  PORT = "3100",
  WEB_URL = "http://127.0.0.1:3000",
  SITE_URL = "",
} = process.env;

const ADMIN_IDS = String(process.env.ADMIN_CHAT_ID || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!BOT_TOKEN) throw new Error("Thiếu BOT_TOKEN trong .env");
if (!API_KEY) throw new Error("Thiếu API_KEY trong .env");

const bot = new Bot(BOT_TOKEN);
const isAdmin = (chatId) => ADMIN_IDS.includes(String(chatId));

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Gọi API nội bộ của web
async function web(action, body = {}) {
  try {
    const res = await fetch(`${WEB_URL}/api/telegram/internal/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    return await res.json();
  } catch (e) {
    console.error(`[web] ${action} lỗi:`, e.message);
    return { ok: false, error: "web_unreachable" };
  }
}

// ================== Lệnh bot ==================
const HELP =
  "<b>StudyNotion Bot</b>\n\n" +
  "/me - Xem tài khoản đã liên kết\n" +
  "/alert_on - Bật cảnh báo đăng nhập\n" +
  "/alert_off - Tắt cảnh báo đăng nhập\n" +
  "/courses - Khóa học của tôi (giảng viên)\n" +
  "/unlink - Hủy liên kết tài khoản\n" +
  "/id - Xem Chat ID\n" +
  "/help - Trợ giúp\n\n" +
  "Để liên kết: vào web → Dashboard → Settings → <b>Kết nối Telegram</b>.";

const ADMIN_HELP = "\n\n<b>Admin:</b>\n/stats - Thống kê người dùng\n/orders - Đơn hàng chờ duyệt";

async function linkWithCode(ctx, code) {
  console.log(`[link] chat ${ctx.chat.id} gửi mã ${code.slice(0, 6)}...`);
  const r = await web("link", {
    code,
    chatId: ctx.chat.id,
    username: ctx.from?.username,
  });

  if (!r.ok) {
    console.log(`[link] thất bại: ${r.error}`);
    const msg =
      r.error === "web_unreachable"
        ? "⚠️ Không kết nối được tới website, vui lòng thử lại sau."
        : "❌ Mã liên kết không hợp lệ hoặc đã hết hạn (10 phút). Hãy bấm lại nút <b>Kết nối Telegram</b> trên web.";
    return ctx.reply(msg, { parse_mode: "HTML" });
  }

  console.log(`[link] OK -> ${r.user.email}`);
  const kb = /^https:\/\//.test(SITE_URL) ? new InlineKeyboard().url("Mở StudyNotion", SITE_URL) : undefined;
  return ctx.reply(
    `✅ Đã liên kết với tài khoản <b>${esc(r.user.name)}</b> (${esc(r.user.email)}).\n\n` +
      "Bạn sẽ nhận cảnh báo đăng nhập và mã khôi phục mật khẩu tại đây.",
    { parse_mode: "HTML", reply_markup: kb }
  );
}

bot.command("start", async (ctx) => {
  const code = (ctx.match || "").trim();
  if (!code) {
    return ctx.reply(`Xin chào ${esc(ctx.from?.first_name)}! 👋\n\n${HELP}`, {
      parse_mode: "HTML",
    });
  }
  return linkWithCode(ctx, code);
});

// Cách dự phòng: /link <mã>  hoặc dán thẳng mã 32 ký tự
bot.command("link", async (ctx) => {
  const code = (ctx.match || "").trim();
  if (!code) return ctx.reply("Cách dùng: /link <mã> (lấy mã ở web → Settings → Kết nối Telegram)");
  return linkWithCode(ctx, code);
});
bot.hears(/^\s*([a-f0-9]{32})\s*$/i, (ctx) => linkWithCode(ctx, ctx.match[1].toLowerCase()));

bot.command("help", (ctx) =>
  ctx.reply(HELP + (isAdmin(ctx.chat.id) ? ADMIN_HELP : ""), { parse_mode: "HTML" })
);

bot.command("id", (ctx) =>
  ctx.reply(`Chat ID của bạn: <code>${ctx.chat.id}</code>`, { parse_mode: "HTML" })
);

bot.command("me", async (ctx) => {
  const r = await web("me", { chatId: ctx.chat.id });
  if (!r.ok) return ctx.reply("⚠️ Không lấy được thông tin, thử lại sau.");
  if (!r.linked) return ctx.reply("Bạn chưa liên kết tài khoản.\n\n" + HELP, { parse_mode: "HTML" });

  const u = r.user;
  const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "-";
  return ctx.reply(
    `👤 <b>${esc(u.name)}</b>\n` +
      `📧 ${esc(u.email)}\n` +
      `📱 ${esc(u.contactNumber || "-")}\n` +
      `🎓 ${esc(u.accountType)}\n` +
      `📚 Khóa học đã đăng ký: ${u.enrolledCourses}\n` +
      `📅 Tham gia: ${joined}\n` +
      `🔔 Cảnh báo đăng nhập: ${u.loginAlert ? "Bật" : "Tắt"}`,
    { parse_mode: "HTML" }
  );
});

const setAlert = (on) => async (ctx) => {
  const r = await web("alert", { chatId: ctx.chat.id, on });
  if (!r.ok) return ctx.reply("⚠️ Lỗi, thử lại sau.");
  if (!r.linked) return ctx.reply("Bạn chưa liên kết tài khoản.");
  return ctx.reply(on ? "🔔 Đã bật cảnh báo đăng nhập." : "🔕 Đã tắt cảnh báo đăng nhập.");
};
bot.command("alert_on", setAlert(true));
bot.command("alert_off", setAlert(false));

bot.command("unlink", async (ctx) => {
  const kb = new InlineKeyboard().text("✅ Xác nhận hủy", "unlink:yes").text("❌ Không", "unlink:no");
  return ctx.reply("Bạn chắc chắn muốn hủy liên kết tài khoản StudyNotion?", { reply_markup: kb });
});

bot.callbackQuery(/^unlink:(yes|no)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.match[1] === "no") return ctx.editMessageText("Đã giữ nguyên liên kết.");
  const r = await web("unlink", { chatId: ctx.chat.id });
  if (!r.ok) return ctx.editMessageText("⚠️ Lỗi, thử lại sau.");
  return ctx.editMessageText(r.unlinked ? "🔌 Đã hủy liên kết." : "Bạn chưa liên kết tài khoản nào.");
});

bot.command("stats", async (ctx) => {
  if (!isAdmin(ctx.chat.id)) return ctx.reply("⛔ Lệnh chỉ dành cho admin.");
  const r = await web("stats");
  if (!r.ok) return ctx.reply("⚠️ Không lấy được thống kê.");
  const s = r.stats;
  return ctx.reply(
    "📊 <b>Thống kê StudyNotion</b>\n\n" +
      `👥 Tổng tài khoản: <b>${s.total}</b>\n` +
      `✅ Đã xác minh: ${s.verified}\n` +
      `🎓 Học viên: ${s.students}\n` +
      `👨‍🏫 Giảng viên: ${s.instructors}\n` +
      `🆕 Mới 24h: ${s.new24h}\n` +
      `✈️ Đã liên kết Telegram: ${s.telegramLinked}\n` +
      `📚 Khóa học: ${s.courses ?? 0} (xuất bản: ${s.coursesPublic ?? 0})`,
    { parse_mode: "HTML" }
  );
});

bot.command("courses", async (ctx) => {
  const r = await web("courses", { chatId: ctx.chat.id });
  if (!r.ok) return ctx.reply("⚠️ Không lấy được dữ liệu, thử lại sau.");
  if (!r.linked) return ctx.reply("Bạn chưa liên kết tài khoản.");
  if (!r.isInstructor) return ctx.reply("Lệnh này dành cho giảng viên.");
  if (!r.courses.length) return ctx.reply("Bạn chưa có khóa học nào.");
  const lines = r.courses.map(
    (c, i) =>
      `${i + 1}. ${c.status === "Public" ? "🟢" : "⚪️"} <b>${esc(c.name)}</b>\n` +
      `    👥 ${c.students} học viên • 💰 ${c.price ? c.price.toLocaleString("vi-VN") + " ₫" : "Miễn phí"}`
  );
  return ctx.reply(`📚 <b>Khóa học của bạn</b>\n\n${lines.join("\n")}\n\n🟢 xuất bản  ⚪️ nháp`, {
    parse_mode: "HTML",
  });
});

// ===== Duyệt đơn hàng (chỉ admin) =====
bot.callbackQuery(/^order:(approve|reject):([0-9a-f-]{36})$/, async (ctx) => {
  if (!isAdmin(ctx.chat?.id ?? ctx.from.id)) {
    return ctx.answerCallbackQuery({ text: "Chỉ admin mới duyệt được đơn", show_alert: true });
  }
  const approve = ctx.match[1] === "approve";
  const r = await web("order", { orderId: ctx.match[2], approve });
  if (!r.ok) {
    const msg = r.error?.startsWith("already_")
      ? `Đơn ${r.code || ""} đã được xử lý trước đó`
      : "Không xử lý được đơn, thử lại sau";
    await ctx.answerCallbackQuery({ text: msg, show_alert: true });
    return ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
  }
  await ctx.answerCallbackQuery({ text: approve ? "Đã xác nhận" : "Đã từ chối" });
  const by = ctx.from.username ? "@" + ctx.from.username : ctx.from.first_name;
  const note = approve
    ? `\n\n✅ <b>ĐÃ XÁC NHẬN</b> bởi ${esc(by)} — học viên đã được ghi danh.`
    : `\n\n❌ <b>ĐÃ TỪ CHỐI</b> bởi ${esc(by)}.`;
  const original = ctx.callbackQuery.message?.text ? esc(ctx.callbackQuery.message.text) : "";
  return ctx
    .editMessageText(original + note, { parse_mode: "HTML" })
    .catch(() => ctx.reply(note.trim(), { parse_mode: "HTML" }));
});

bot.command("orders", async (ctx) => {
  if (!isAdmin(ctx.chat.id)) return ctx.reply("⛔ Lệnh chỉ dành cho admin.");
  const r = await web("orders");
  if (!r.ok) return ctx.reply("⚠️ Không lấy được đơn hàng.");
  if (!r.orders.length) return ctx.reply("✅ Không có đơn nào đang chờ.");
  for (const o of r.orders) {
    const kb = new InlineKeyboard()
      .text("✅ Đã nhận tiền", `order:approve:${o.id}`)
      .text("❌ Từ chối", `order:reject:${o.id}`);
    await ctx.reply(
      `🛒 <b>${esc(o.code)}</b> — ${esc(o.amount)}\n👤 ${esc(o.email)}\n` +
        o.items.map((n) => `• ${esc(n)}`).join("\n"),
      { parse_mode: "HTML", reply_markup: kb }
    );
  }
});

bot.on("message", (ctx) => ctx.reply("Gõ /help để xem các lệnh."));

bot.catch((err) => {
  const e = err.error;
  if (e instanceof GrammyError) console.error("Telegram API error:", e.description);
  else if (e instanceof HttpError) console.error("Không kết nối được Telegram:", e);
  else console.error("Lỗi bot:", e);
});

// ================== API nội bộ (web gọi vào) ==================
const app = express();
app.use(express.json({ limit: "100kb" }));

const safeEqual = (a, b) => {
  if (!a || !b) return false;
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (!safeEqual(req.headers["x-api-key"], API_KEY)) return res.sendStatus(403);
  next();
});

const PARSE_MODES = ["HTML", "MarkdownV2"];

function buildKeyboard(buttons) {
  if (!Array.isArray(buttons) || !buttons.length) return undefined;
  const kb = new InlineKeyboard();
  buttons.forEach((row, i) => {
    if (i > 0) kb.row();
    (Array.isArray(row) ? row : [row]).forEach((b) => {
      if (b && b.url) kb.url(String(b.text).slice(0, 64), String(b.url));
      else if (b && b.data) kb.text(String(b.text).slice(0, 64), String(b.data).slice(0, 64));
    });
  });
  return kb;
}

async function send(chatId, text, parseMode, buttons) {
  const opts = PARSE_MODES.includes(parseMode) ? { parse_mode: parseMode } : {};
  const kb = buildKeyboard(buttons);
  if (kb) opts.reply_markup = kb;
  try {
    await bot.api.sendMessage(chatId, String(text).slice(0, 4096), opts);
    return { chatId, ok: true };
  } catch (e) {
    // Lỗi HTML thì gửi lại dạng text thường
    if (opts.parse_mode && e instanceof GrammyError && e.error_code === 400) {
      try {
        await bot.api.sendMessage(chatId, String(text).replace(/<[^>]+>/g, "").slice(0, 4096), kb ? { reply_markup: kb } : {});
        return { chatId, ok: true };
      } catch (e2) {
        return { chatId, ok: false, error: e2.description || e2.message };
      }
    }
    return { chatId, ok: false, error: e.description || e.message };
  }
}

// Gửi cho admin: { text, parse_mode? }
app.post("/notify", async (req, res) => {
  const { text, parse_mode, buttons } = req.body || {};
  if (!text) return res.status(400).json({ ok: false, error: "missing_text" });
  if (!ADMIN_IDS.length) return res.status(500).json({ ok: false, error: "ADMIN_CHAT_ID chưa cấu hình" });

  const results = await Promise.all(ADMIN_IDS.map((id) => send(id, text, parse_mode, buttons)));
  const ok = results.some((r) => r.ok);
  res.status(ok ? 200 : 500).json({ ok, results });
});

// Gửi cho 1 chat: { chatId, text, parse_mode? }
app.post("/send", async (req, res) => {
  const { chatId, text, parse_mode } = req.body || {};
  if (!chatId || !text) return res.status(400).json({ ok: false, error: "missing_params" });
  const r = await send(chatId, text, parse_mode);
  res.status(r.ok ? 200 : 500).json(r);
});

app.get("/health", (req, res) => res.json({ ok: true, bot: bot.botInfo?.username || null }));

const server = app.listen(Number(PORT), "127.0.0.1", () =>
  console.log(`API nội bộ chạy tại 127.0.0.1:${PORT}`)
);

// ================== Khởi động ==================
(async () => {
  await bot.api.setMyCommands([
    { command: "me", description: "Xem tài khoản đã liên kết" },
    { command: "link", description: "Liên kết tài khoản bằng mã" },
    { command: "alert_on", description: "Bật cảnh báo đăng nhập" },
    { command: "alert_off", description: "Tắt cảnh báo đăng nhập" },
    { command: "courses", description: "Khóa học của tôi (giảng viên)" },
    { command: "unlink", description: "Hủy liên kết tài khoản" },
    { command: "id", description: "Xem Chat ID" },
    { command: "help", description: "Trợ giúp" },
  ]).catch((e) => console.warn("setMyCommands lỗi:", e.message));

  bot.start({
    drop_pending_updates: true,
    onStart: (info) => console.log(`Bot @${info.username} đã khởi động`),
  }).catch((e) => {
    console.error("Bot dừng do lỗi:", e.description || e.message);
    process.exit(1); // pm2 sẽ tự khởi động lại
  });
})();

const shutdown = () => {
  console.log("Đang dừng bot...");
  server.close();
  bot.stop().finally(() => process.exit(0));
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
