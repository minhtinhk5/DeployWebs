import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User } from "@/database/entity/User.entity";
import { Course, Status } from "@/database/entity/Course.entity";
import { Category } from "@/database/entity/Category.entity";
import { Section } from "@/database/entity/Section.entity";
import { SubSection } from "@/database/entity/SubSection.entity";
import { NEXT_AUTH } from "@/services/NextAuth";
import { getServerSession } from "next-auth";
import z from "zod";

export { Status };

/** Lấy user đang đăng nhập nếu là Instructor (hoặc Admin) */
export async function getInstructor() {
  const session = await getServerSession(NEXT_AUTH);
  if (!session?.user?.id) return null;
  await InitializeDatabase();
  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: session.user.id },
  });
  if (!user || (user.accountType !== "Instructor" && user.accountType !== "Admin")) return null;
  return user;
}

export async function getOwnedCourse(courseId: string, instructorId: string, withContent = false) {
  await InitializeDatabase();
  return AppDataSource.getRepository(Course).findOne({
    where: { id: courseId, instructor: { id: instructorId } },
    relations: withContent
      ? ["category", "courseContent", "courseContent.subSection", "studentsEnrolled"]
      : ["category"],
    order: withContent
      ? { courseContent: { order: "ASC", subSection: { order: "ASC" } } }
      : undefined,
  });
}

const lectureSchema = z.object({
  title: z.string().trim().min(1, "Bài học cần có tiêu đề").max(200),
  description: z.string().trim().max(5000).default(""),
  videoUrl: z.string().trim().url("Link video không hợp lệ").max(500),
  timeDuration: z.string().trim().max(20).default(""),
  isPreview: z.boolean().default(false),
});

const sectionSchema = z.object({
  sectionName: z.string().trim().min(1, "Chương cần có tên").max(200),
  lectures: z.array(lectureSchema).max(200).default([]),
});

export const courseSchema = z.object({
  courseName: z.string().trim().min(3, "Tên khóa học tối thiểu 3 ký tự").max(200),
  courseDescription: z.string().trim().min(10, "Mô tả tối thiểu 10 ký tự").max(10000),
  price: z.coerce.number().min(0, "Giá không hợp lệ").max(1_000_000_000),
  categoryId: z.string().trim().optional().default(""),
  newCategory: z.string().trim().max(100).optional().default(""),
  tag: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  whatYouWillLearn: z.string().trim().min(5, "Nhập lợi ích của khóa học").max(5000),
  instructions: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  thumbnailUrl: z.string().trim().max(500).optional().default(""),
  status: z.enum([Status.DRAFT, Status.PUBLIC]).default(Status.DRAFT),
  sections: z.array(sectionSchema).max(100).default([]),
});

export type CourseInput = z.infer<typeof courseSchema>;

/** Tìm danh mục theo id, hoặc tạo mới theo tên */
export async function resolveCategory(input: CourseInput) {
  const repo = AppDataSource.getRepository(Category);
  if (input.newCategory) {
    const existing = await repo.findOne({ where: { name: input.newCategory } });
    if (existing) return existing;
    const c = new Category();
    c.name = input.newCategory;
    return repo.save(c);
  }
  if (input.categoryId) {
    return repo.findOne({ where: { id: input.categoryId } });
  }
  return null;
}

/** Ghi thông tin + toàn bộ nội dung (thay thế chương/bài cũ) trong 1 transaction */
export async function saveCourse(
  course: Course,
  input: CourseInput,
  thumbnail: string | null
) {
  const category = await resolveCategory(input);

  return AppDataSource.transaction(async (m) => {
    course.courseName = input.courseName;
    course.courseDescription = input.courseDescription;
    course.price = input.price;
    course.tag = input.tag;
    course.whatYouWillLearn = input.whatYouWillLearn;
    course.instructions = input.instructions;
    course.status = input.status;
    if (category) course.category = category;
    if (thumbnail) course.thumbnail = thumbnail;

    const saved = await m.save(Course, course);

    // Thay thế nội dung cũ (cascade xóa bài học)
    await m.delete(Section, { course: { id: saved.id } });

    for (let i = 0; i < input.sections.length; i++) {
      const s = input.sections[i];
      const section = m.create(Section, { sectionName: s.sectionName, order: i, course: saved });
      const savedSection = await m.save(Section, section);

      for (let j = 0; j < s.lectures.length; j++) {
      const l = s.lectures[j];
        await m.save(
          SubSection,
          m.create(SubSection, {
            title: l.title,
            description: l.description,
            videoUrl: l.videoUrl,
            timeDuration: l.timeDuration,
            isPreview: l.isPreview,
            order: j,
            section: savedSection,
          })
        );
      }
    }
    return saved;
  });
}

/** Chuyển entity -> dữ liệu cho form sửa */
export function courseToInput(course: Course) {
  return {
    id: course.id,
    courseName: course.courseName,
    courseDescription: course.courseDescription,
    price: course.price,
    categoryId: course.category?.id ?? "",
    newCategory: "",
    tag: course.tag?.filter(Boolean) ?? [],
    whatYouWillLearn: course.whatYouWillLearn,
    instructions: course.instructions?.filter(Boolean) ?? [],
    thumbnailUrl: course.thumbnail ?? "",
    status: course.status,
    sections: (course.courseContent ?? [])
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        sectionName: s.sectionName,
        lectures: (s.subSection ?? [])
          .sort((a, b) => a.order - b.order)
          .map((l) => ({
            title: l.title,
            description: l.description,
            videoUrl: l.videoUrl,
            timeDuration: l.timeDuration,
            isPreview: l.isPreview,
          })),
      })),
  };
}

export const formatPrice = (price: number) =>
  Number(price) === 0 ? "Miễn phí" : `${Number(price).toLocaleString("vi-VN")} ₫`;
