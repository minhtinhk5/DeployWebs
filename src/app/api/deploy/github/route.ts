/**
 * GitHub Webhook -> CI/CD
 * GitHub gửi POST khi có push; xác thực chữ ký HMAC-SHA256 (X-Hub-Signature-256)
 * rồi chạy ops/cicd/deploy.sh ở tiến trình tách rời (không bị dừng khi app restart).
 */
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function validSignature(body: string, header: string | null, secret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.DEPLOY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "webhook chưa cấu hình" }, { status: 503 });

  const body = await req.text();
  if (!validSignature(body, req.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ ok: false, error: "sai chữ ký" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  if (event === "ping") return NextResponse.json({ ok: true, pong: true });
  if (event !== "push") return NextResponse.json({ ok: true, ignored: event });

  let payload: { ref?: string; after?: string; head_commit?: { message?: string } } = {};
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: "payload lỗi" }, { status: 400 });
  }

  const branch = process.env.DEPLOY_BRANCH || "main";
  if (payload.ref !== `refs/heads/${branch}`) {
    return NextResponse.json({ ok: true, ignored: payload.ref });
  }

  const appDir = process.cwd();
  const script = process.env.DEPLOY_SCRIPT || path.join(appDir, "ops/cicd/deploy.sh");
  if (!fs.existsSync(script)) return NextResponse.json({ ok: false, error: "không thấy deploy.sh" }, { status: 500 });

  const logDir = path.join(process.env.HOME || "/tmp", "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const log = path.join(logDir, "deploy.log");
  const q = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

  // setsid + & : tách hẳn khỏi tiến trình Next để pm2 restart không giết deploy
  const child = spawn(
    "setsid",
    ["bash", "-c", `nohup bash ${q(script)} ${q(payload.after || "")} >> ${q(log)} 2>&1 &`],
    { cwd: appDir, detached: true, stdio: "ignore", env: { ...process.env, APP_DIR: appDir } }
  );
  child.unref();

  return NextResponse.json({ ok: true, deploying: payload.after?.slice(0, 7) }, { status: 202 });
}
