import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { redisHealth } from "@/lib/redis";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Kiểm tra sức khỏe: MySQL + Redis (dùng cho CI/CD rollback & giám sát) */
export async function GET() {
  const started = Date.now();
  let mysql: Record<string, unknown> = { status: "down" };
  try {
    await InitializeDatabase();
    const t = Date.now();
    await AppDataSource.query("SELECT 1");
    mysql = { status: "up", latencyMs: Date.now() - t };
  } catch (e) {
    mysql = { status: "down", error: (e as Error).message };
  }
  const redis = await redisHealth();
  const ok = mysql.status === "up";
  return NextResponse.json(
    {
      ok,
      version: process.env.APP_VERSION || null,
      uptimeSec: Math.round(process.uptime()),
      mysql,
      redis,
      tookMs: Date.now() - started,
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
