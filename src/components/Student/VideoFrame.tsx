type Embed = { type: "iframe" | "video" | "link"; src: string; watch?: string };

export default function VideoFrame({ embed, title }: { embed: Embed; title?: string }) {
  if (embed.type === "iframe")
    return (
      <div>
        <iframe
          src={embed.src}
          title={title || "video"}
          className="aspect-video w-full rounded-md bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          // YouTube bắt buộc có Referer, thiếu sẽ báo "Lỗi 153"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
        {embed.watch && (
          <p className="mt-2 text-right text-xs text-richblack-400">
            Video không phát được?{" "}
            <a href={embed.watch} target="_blank" rel="noreferrer" className="text-yellow-50 underline">
              Mở trên trang gốc
            </a>
          </p>
        )}
      </div>
    );
  if (embed.type === "video")
    return <video src={embed.src} controls className="aspect-video w-full rounded-md bg-black" />;
  return (
    <div className="grid aspect-video w-full place-items-center rounded-md bg-richblack-800 p-6 text-center">
      <div>
        <p className="mb-3 text-richblack-200">Video này không nhúng được, hãy mở ở tab mới.</p>
        <a href={embed.src} target="_blank" rel="noreferrer" className="rounded-md bg-yellow-50 px-5 py-2 font-semibold text-richblack-900">
          Mở video
        </a>
      </div>
    </div>
  );
}
