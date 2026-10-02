import CourseForm from "@/components/Dashboard/courses/CourseForm";
import NotInstructor from "@/components/Dashboard/courses/NotInstructor";
import { getInstructor } from "@/lib/courses";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thêm khóa học | StudyNotion" };

export default async function AddCoursePage() {
  const instructor = await getInstructor();
  if (!instructor) return <NotInstructor />;

  return (
    <div>
      <h1 className="mb-2 text-3xl font-medium text-richblack-5">Thêm khóa học</h1>
      <p className="mb-10 text-richblack-300">
        Điền thông tin, xây dựng chương/bài học rồi xuất bản.
      </p>
      <CourseForm />
    </div>
  );
}
