import { AppDataSource } from "@/database/dataSource";
import { Order, OrderStatus } from "@/database/entity/Order.entity";
import { getSessionUser } from "@/lib/student";
import { NextResponse, type NextRequest } from "next/server";

type Ctx = { params: { id: string } };

async function ownOrder(id: string) {
  const user = await getSessionUser();
  if (!user) return null;
  return AppDataSource.getRepository(Order).findOne({ where: { id, user: { id: user.id } } });
}

/** Trạng thái đơn (trang thanh toán tự hỏi lại) */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const order = await ownOrder(params.id);
  if (!order) return NextResponse.json({ success: false }, { status: 404 });
  return NextResponse.json({ success: true, status: order.status });
}

/** Học viên hủy đơn đang chờ */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const order = await ownOrder(params.id);
  if (!order) return NextResponse.json({ success: false, message: "Không tìm thấy đơn" }, { status: 404 });
  if (order.status !== OrderStatus.PENDING)
    return NextResponse.json({ success: false, message: "Chỉ hủy được đơn đang chờ" });
  order.status = OrderStatus.CANCELLED;
  await AppDataSource.getRepository(Order).save(order);
  return NextResponse.json({ success: true, message: "Đã hủy đơn" });
}
