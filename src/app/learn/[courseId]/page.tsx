import LearnView from "@/components/Student/LearnView";
import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { Course } from "@/database/entity/Course.entity";
import { CourseProgress } from "@/database/entity/CourseProgress.entity";
import { RatingsAndReviews } from "@/database/entity/RatingsAndReviews.entity";
import { getSessionUser, isEnrolled, toEmbed } from "@/lib/student";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function LearnPage({ params }: { params: { courseId: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  await InitializeDatabase();
  const course = await AppDataSource.getRepository(Course).findOne({
    where: { id: params.courseId },
    relations: ["instructor", "courseContent", "courseContent.subSection"],
    order: { courseContent: { order: "ASC", subSection: { order: "ASC" } } },
  });
  if (!course) redirect("/dashboard/enrolled-courses");

  const enrolled = await isEnrolled(user.id, course.id);
  const isOwner = course.instructor?.id === user.id || user.accountType === "Admin";
  if (!enrolled && !isOwner) {
    return (
      <div className="py-32 text-center text-richblack-5">
        <p className="mb-4 text-2xl font-semibold">Bạn chưa đăng ký khóa học này</p>
        <Link href={`/courses/${course.id}`} className="rounded-md bg-yellow-50 px-5 py-2 font-semibold text-richblack-900">
          Xem khóa học
        </Link>
      </div>
    );
  }

  const progress = enrolled
    ? await AppDataSource.getRepository(CourseProgress).findOne({
        where: { user: { id: user.id }, courseId: course.id },
      })
    : null;

  const myReview = enrolled
    ? await AppDataSource.getRepository(RatingsAndReviews).findOne({
        where: { user: { id: user.id }, course: { id: course.id } },
      })
    : null;

  const sections = (course.courseContent ?? []).map((s) => ({
    id: s.id,
    name: s.sectionName,
    lectures: (s.subSection ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      timeDuration: l.timeDuration,
      embed: toEmbed(l.videoUrl),
    })),
  }));

  return (
    <Suspense>
      <LearnView
        courseId={course.id}
        courseName={course.courseName}
        sections={sections}
        completed={progress?.completedLectures ?? []}
        canTrack={enrolled}
        myReview={myReview ? { rating: myReview.rating, review: myReview.review } : null}
      />
    </Suspense>
  );
}
