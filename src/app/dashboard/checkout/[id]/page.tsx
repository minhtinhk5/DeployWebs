import OrderWatcher from "@/components/Student/OrderWatcher";
import { AppDataSource } from "@/database/dataSource";
import { Order, OrderStatus } from "@/database/entity/Order.entity";
import { getSessionUser, paymentInfo, vnd } from "@/lib/student";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  Pending: { label: "Chờ thanh toán", cls: "bg-yellow-900 text-yellow-50" },
  Paid: { label: "Đã thanh toán", cls: "bg-caribbeangreen-900 text-caribbeangreen-100" },
  Rejected: { label: "Bị từ chối", cls: "bg-pink-900 text-pink-100" },
  Cancelled: { label: "Đã hủy", cls: "bg-richblack-700 text-richblack-200" },
};

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return null;
  const order = await AppDataSource.getRepository(Order).findOne({
    where: { id: params.id, user: { id: user.id } },
  });
  if (!order)
    return (
      <div className="py-24 text-center text-richblack-5">
        <p className="mb-4 text-2xl">Không tìm thấy đơn hàng</p>
        <Link href="/dashboard/cart" className="text-yellow-50 underline">Về giỏ hàng</Link>
      </div>
    );

  const pay = paymentInfo(order.amount, order.code);
  const st = STATUS[order.status];

  return (
    <div className="text-richblack-5">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-medium">Đơn hàng {order.code}</h1>
        <span className={`rounded-full px-3 py-1 text-sm ${st.cls}`}>{st.label}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          {order.status === OrderStatus.PENDING && (
            <div className="rounded-md border border-richblack-700 bg-richblack-800 p-6">
              <h2 className="mb-4 text-xl font-semibold">Chuyển khoản để hoàn tất</h2>
              <div className="flex flex-col gap-6 md:flex-row">
                {pay.qr && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pay.qr} alt="VietQR" className="w-[220px] self-center rounded-md bg-white p-2" />
                )}
                <dl className="grid flex-1 grid-cols-[120px_1fr] gap-y-3 text-sm">
                  {pay.bank && (<><dt className="text-richblack-300">Ngân hàng</dt><dd className="font-semibold">{pay.bank}</dd></>)}
                  {pay.account && (<><dt className="text-richblack-300">Số tài khoản</dt><dd className="font-mono font-semibold">{pay.account}</dd></>)}
                  {pay.name && (<><dt className="text-richblack-300">Chủ tài khoản</dt><dd className="font-semibold">{pay.name}</dd></>)}
                  <dt className="text-richblack-300">Số tiền</dt>
                  <dd className="text-lg font-semibold text-yellow-50">{vnd(order.amount)}</dd>
                  <dt className="text-richblack-300">Nội dung</dt>
                  <dd><code className="rounded bg-richblack-900 px-2 py-1 font-mono text-lg text-yellow-50">{order.code}</code></dd>
                </dl>
              </div>
              {!pay.account && (
                <p className="mt-4 rounded-md bg-richblack-700 p-3 text-sm text-richblack-200">
                  {pay.note || "Liên hệ quản trị viên để nhận thông tin chuyển khoản."}
                </p>
              )}
              {pay.account && pay.note && <p className="mt-4 text-sm text-richblack-300">{pay.note}</p>}
              <p className="mt-4 text-sm text-richblack-300">
                ⚠️ Ghi đúng nội dung <b className="text-yellow-50">{order.code}</b>. Sau khi admin xác nhận
                (thường vài phút), khóa học sẽ tự mở — trang này tự cập nhật.
              </p>
              <div className="mt-5 border-t border-richblack-700 pt-4">
                <OrderWatcher orderId={order.id} status={order.status} />
              </div>
            </div>
          )}

          {order.status === OrderStatus.PAID && (
            <div className="rounded-md border border-caribbeangreen-700 bg-richblack-800 p-6">
              <p className="text-xl font-semibold">🎉 Thanh toán thành công!</p>
              <p className="mt-2 text-richblack-300">Bạn đã có thể bắt đầu học.</p>
              <Link href="/dashboard/enrolled-courses" className="mt-4 inline-block rounded-md bg-yellow-50 px-5 py-2 font-semibold text-richblack-900">
                Đến khóa học của tôi →
              </Link>
            </div>
          )}

          {(order.status === OrderStatus.REJECTED || order.status === OrderStatus.CANCELLED) && (
            <div className="rounded-md border border-richblack-700 bg-richblack-800 p-6">
              <p className="text-richblack-200">
                {order.status === OrderStatus.REJECTED
                  ? "Đơn hàng chưa được xác nhận thanh toán. Nếu bạn đã chuyển khoản, vui lòng liên hệ hỗ trợ kèm mã đơn."
                  : "Đơn hàng đã được hủy."}
              </p>
              <Link href="/catalog" className="mt-4 inline-block text-yellow-50 underline">Xem khóa học</Link>
            </div>
          )}
        </div>

        <div className="h-fit rounded-md border border-richblack-700 bg-richblack-800 p-6">
          <h3 className="mb-4 font-semibold">Chi tiết đơn</h3>
          <ul className="flex flex-col gap-3 text-sm">
            {order.items.map((i) => (
              <li key={i.courseId} className="flex justify-between gap-3">
                <Link href={`/courses/${i.courseId}`} className="text-richblack-100 hover:text-yellow-50">{i.name}</Link>
                <span className="shrink-0">{vnd(i.price)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-richblack-700 pt-4 font-semibold">
            <span>Tổng</span><span className="text-yellow-50">{vnd(order.amount)}</span>
          </div>
          <p className="mt-3 text-xs text-richblack-400">Tạo lúc {new Date(order.createdAt).toLocaleString("vi-VN")}</p>
        </div>
      </div>
    </div>
  );
}
