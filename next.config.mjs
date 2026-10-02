/** @type {import('next').NextConfig} */
const nextConfig = {
  // CI/CD build ra thư mục riêng (NEXT_DIST_DIR=.next-build) rồi mới tráo vào .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverComponentsExternalPackages: ["typeorm", "bcrypt"],
    serverMinification: false,
  },
  // SỬA: next/image với ảnh ngoài bắt buộc khai báo domain (logo Google ở trang login bị lỗi)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.svgrepo.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
  poweredByHeader: false,
  // Cho phép gửi Referer tới YouTube/Vimeo (tránh lỗi 153 khi nhúng video)
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] }];
  },
};

export default nextConfig;
