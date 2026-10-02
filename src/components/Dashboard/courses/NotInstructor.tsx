import Link from "next/link";

export default function NotInstructor() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-2xl font-semibold text-richblack-5">Chỉ dành cho giảng viên</p>
      <p className="max-w-md text-richblack-300">
        Trang này dành cho tài khoản Instructor. Hãy đăng nhập bằng tài khoản giảng viên.
      </p>
      <Link href="/dashboard/my-profile" className="rounded-md bg-yellow-50 px-5 py-2 font-semibold text-richblack-900">
        Về trang hồ sơ
      </Link>
    </div>
  );
}
