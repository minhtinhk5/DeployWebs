import CartView, { type CartRow } from "@/components/Student/CartView";
import { AppDataSource } from "@/database/dataSource";
import { CartItem } from "@/database/entity/CartItem.entity";
import { Status } from "@/database/entity/Course.entity";
import { getSessionUser } from "@/lib/student";

export const dynamic = "force-dynamic";
export const metadata = { title: "Giỏ hàng | StudyNotion" };

export default async function CartPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const items = await AppDataSource.getRepository(CartItem).find({
    where: { user: { id: user.id } },
    relations: ["course", "course.instructor", "course.courseContent", "course.courseContent.subSection"],
    order: { createdAt: "DESC" },
  });

  const rows: CartRow[] = items
    .filter((i) => i.course && i.course.status === Status.PUBLIC)
    .map((i) => ({
      courseId: i.course.id,
      courseName: i.course.courseName,
      thumbnail: i.course.thumbnail ?? null,
      instructor: i.course.instructor ? `${i.course.instructor.firstName} ${i.course.instructor.lastName}` : "",
      price: Number(i.course.price),
      lectures: (i.course.courseContent ?? []).reduce((n, s) => n + (s.subSection?.length ?? 0), 0),
    }));

  return (
    <div className="text-richblack-5">
      <h1 className="mb-10 text-3xl font-medium">Giỏ hàng</h1>
      <CartView items={rows} />
    </div>
  );
}
