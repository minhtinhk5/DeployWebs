import Link from "next/link";

// Các mục trên sidebar (My Courses, Cart, ...) chưa được xây dựng.
// Trước đây bấm vào sẽ ra 404, giờ hiển thị thông báo rõ ràng.
export default function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-3xl font-semibold text-richblack-5">Tính năng đang phát triển</p>
      <p className="max-w-md text-richblack-300">
        Mục này sẽ sớm ra mắt. Bạn có thể quay lại trang hồ sơ trong lúc chờ.
      </p>
      <Link
        href="/dashboard/my-profile"
        className="rounded-md bg-yellow-50 px-5 py-2 font-semibold text-richblack-900"
      >
        Về trang hồ sơ
      </Link>
    </div>
  );
}
