import Link from "next/link";
import { FiBookOpen, FiUsers } from "react-icons/fi";

export type CourseCardData = {
  id: string;
  courseName: string;
  thumbnail: string | null;
  price: number;
  instructor: string;
  category: string | null;
  students: number;
  lectures: number;
  rating?: number | null;
  reviews?: number;
};

const vnd = (n: number) =>
  Number(n) === 0 ? "Miễn phí" : `${Math.round(Number(n)).toLocaleString("vi-VN")} ₫`;

export default function CourseCard({ c }: { c: CourseCardData }) {
  return (
    <Link
      href={`/courses/${c.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-richblack-700 bg-richblack-800 transition-all duration-200 hover:-translate-y-1 hover:border-richblack-500"
    >
      {c.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.thumbnail} alt="" className="aspect-video w-full object-cover" />
      ) : (
        <div className="grid aspect-video w-full place-items-center bg-richblack-700 text-4xl text-richblack-400">
          <FiBookOpen />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1 p-4">
        {c.category && <span className="text-xs text-yellow-50">{c.category}</span>}
        <h3 className="line-clamp-2 font-semibold text-richblack-5 group-hover:text-yellow-25">{c.courseName}</h3>
        <p className="text-sm text-richblack-300">{c.instructor}</p>
        {c.rating ? (
          <p className="flex items-center gap-1 text-sm">
            <span className="font-semibold text-yellow-50">{c.rating.toFixed(1)}</span>
            <span className="text-yellow-50">{"★".repeat(Math.round(c.rating))}</span>
            <span className="text-richblack-400">({c.reviews})</span>
          </p>
        ) : null}
        <p className="mt-1 flex items-center gap-3 text-xs text-richblack-400">
          <span className="flex items-center gap-1"><FiBookOpen /> {c.lectures} bài</span>
          <span className="flex items-center gap-1"><FiUsers /> {c.students}</span>
        </p>
        <p className="mt-auto pt-3 text-lg font-semibold text-richblack-5">{vnd(c.price)}</p>
      </div>
    </Link>
  );
}
