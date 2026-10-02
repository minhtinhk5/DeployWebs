export type ReviewItem = {
  id: string;
  name: string;
  image: string | null;
  rating: number;
  review: string | null;
  date: string;
};

export function Stars({ value, className = "" }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={`text-yellow-50 ${className}`}>
      {"★".repeat(full)}
      <span className="text-richblack-500">{"★".repeat(5 - full)}</span>
    </span>
  );
}

export default function ReviewList({ reviews }: { reviews: ReviewItem[] }) {
  const avg = reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : 0;
  const dist = [5, 4, 3, 2, 1].map((s) => ({
    s,
    n: reviews.filter((r) => Math.round(r.rating) === s).length,
  }));

  if (!reviews.length)
    return <p className="text-richblack-300">Chưa có đánh giá nào. Học viên hoàn thành khóa học sẽ đánh giá tại đây.</p>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="text-center">
          <p className="text-5xl font-bold text-yellow-50">{avg.toFixed(1)}</p>
          <Stars value={avg} className="text-lg" />
          <p className="text-sm text-richblack-300">{reviews.length} đánh giá</p>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          {dist.map(({ s, n }) => (
            <div key={s} className="flex items-center gap-3 text-sm">
              <span className="w-10 text-richblack-300">{s} ★</span>
              <div className="h-2 flex-1 rounded-full bg-richblack-700">
                <div className="h-2 rounded-full bg-yellow-50" style={{ width: `${(n / reviews.length) * 100}%` }} />
              </div>
              <span className="w-6 text-right text-richblack-400">{n}</span>
            </div>
          ))}
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-richblack-700">
        {reviews.map((r) => (
          <li key={r.id} className="flex gap-4 py-5">
            {r.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-richblack-700">{r.name[0]}</div>
            )}
            <div>
              <p className="font-semibold text-richblack-5">{r.name}</p>
              <p className="text-sm"><Stars value={r.rating} /> <span className="ml-2 text-richblack-400">{r.date}</span></p>
              {r.review && <p className="mt-2 whitespace-pre-line text-richblack-100">{r.review}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
