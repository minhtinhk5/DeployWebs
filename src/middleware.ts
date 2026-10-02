import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Đã đăng nhập thì không vào trang login/signup nữa
  // (SỬA: bản cũ chuyển về /dashboard - trang không tồn tại => 404)
  if (token && (pathname === "/auth/login" || pathname === "/auth/signup")) {
    return NextResponse.redirect(new URL("/dashboard/my-profile", req.url));
  }

  if (!token && (pathname.startsWith("/dashboard") || pathname.startsWith("/learn"))) {
    const url = new URL("/auth/login", req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Chỉ chạy middleware ở các route cần thiết (bản cũ chạy cho mọi request kể cả ảnh/css)
export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*", "/learn/:path*"],
};
