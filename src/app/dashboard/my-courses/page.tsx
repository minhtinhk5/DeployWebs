import CourseTable, { type CourseRow } from "@/components/Dashboard/courses/CourseTable";
import NotInstructor from "@/components/Dashboard/courses/NotInstructor";
import { AppDataSource } from "@/database/dataSource";
import { Course } from "@/database/entity/Course.entity";
import { getInstructor } from "@/lib/courses";
import Link from "next/link";
import { FiPlus } from "react-icons/fi";

export const dynamic = "force-dynamic";
export const metadata = { title: "Khóa học của tôi | StudyNotion" };

export default async function MyCoursesPage() {
  const instructor = await getInstructor();
  if (!instructor) return <NotInstructor />;

  const courses = await AppDataSource.getRepository(Course).find({
    where: { instructor: { id: instructor.id } },
    relations: ["category", "studentsEnrolled", "courseContent", "courseContent.subSection"],
    order: { createdAt: "DESC" },
  });

  const rows: CourseRow[] = courses.map((c) => ({
    id: c.id,
    courseName: c.courseName,
    courseDescription: c.courseDescription,
    price: Number(c.price),
    status: c.status as CourseRow["status"],
    thumbnail: c.thumbnail ?? null,
    category: c.category?.name ?? null,
    students: c.studentsEnrolled?.length ?? 0,
    lectures: (c.courseContent ?? []).reduce((n, s) => n + (s.subSection?.length ?? 0), 0),
    createdAt: new Date(c.createdAt).toISOString(),
  }));

  return (
    <div>
      <div className="mb-10 flex items-center justify-between">
        <h1 className="text-3xl font-medium text-richblack-5">Khóa học của tôi</h1>
        <Link
          href="/dashboard/add-course"
          className="flex items-center gap-2 rounded-md bg-yellow-50 px-4 py-2 font-semibold text-richblack-900"
        >
          <FiPlus /> Thêm mới
        </Link>
      </div>
      <CourseTable courses={rows} />
    </div>
  );
}
