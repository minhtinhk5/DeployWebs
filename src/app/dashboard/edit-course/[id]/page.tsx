import CourseForm, { type CourseFormData } from "@/components/Dashboard/courses/CourseForm";
import NotInstructor from "@/components/Dashboard/courses/NotInstructor";
import { courseToInput, getInstructor, getOwnedCourse } from "@/lib/courses";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({ params }: { params: { id: string } }) {
  const instructor = await getInstructor();
  if (!instructor) return <NotInstructor />;

  const course = await getOwnedCourse(params.id, instructor.id, true);
  if (!course) {
    return (
      <div className="py-24 text-center text-richblack-5">
        <p className="mb-4 text-2xl font-semibold">Không tìm thấy khóa học</p>
        <Link href="/dashboard/my-courses" className="text-yellow-50 underline">
          Về danh sách khóa học
        </Link>
      </div>
    );
  }

  const initial = JSON.parse(JSON.stringify(courseToInput(course))) as CourseFormData;

  return (
    <div>
      <h1 className="mb-2 text-3xl font-medium text-richblack-5">Sửa khóa học</h1>
      <p className="mb-10 text-richblack-300">{course.courseName}</p>
      <CourseForm initial={initial} />
    </div>
  );
}
