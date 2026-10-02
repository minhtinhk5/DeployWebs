"use client";

import { useState } from "react";
import { FiChevronDown, FiChevronRight, FiLock, FiPlayCircle, FiX } from "react-icons/fi";
import VideoFrame from "./VideoFrame";

export type PublicLecture = {
  id: string;
  title: string;
  timeDuration: string;
  preview: { type: "iframe" | "video" | "link"; src: string; watch?: string } | null;
};
export type PublicSection = { id: string; name: string; lectures: PublicLecture[] };

export default function CourseContentList({ sections }: { sections: PublicSection[] }) {
  const [open, setOpen] = useState<string[]>(sections.slice(0, 1).map((s) => s.id));
  const [playing, setPlaying] = useState<PublicLecture | null>(null);

  const toggle = (id: string) =>
    setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  return (
    <div className="overflow-hidden rounded-md border border-richblack-600">
      {sections.map((s) => (
        <div key={s.id} className="border-b border-richblack-600 last:border-b-0">
          <button
            onClick={() => toggle(s.id)}
            className="flex w-full items-center justify-between gap-3 bg-richblack-700 px-5 py-4 text-left"
          >
            <span className="flex items-center gap-2 font-medium">
              {open.includes(s.id) ? <FiChevronDown /> : <FiChevronRight />} {s.name}
            </span>
            <span className="shrink-0 text-sm text-yellow-50">{s.lectures.length} bài</span>
          </button>
          {open.includes(s.id) && (
            <ul>
              {s.lectures.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-richblack-100">
                  <span className="flex items-center gap-2">
                    {l.preview ? <FiPlayCircle className="text-yellow-50" /> : <FiLock className="text-richblack-400" />}
                    {l.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-richblack-400">
                    {l.preview && (
                      <button onClick={() => setPlaying(l)} className="text-yellow-50 underline">
                        Xem thử
                      </button>
                    )}
                    {l.timeDuration}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {playing?.preview && (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/80 p-4" onClick={() => setPlaying(null)}>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between text-richblack-5">
              <p className="font-semibold">{playing.title}</p>
              <button onClick={() => setPlaying(null)} className="text-2xl"><FiX /></button>
            </div>
            <VideoFrame embed={playing.preview} title={playing.title} />
          </div>
        </div>
      )}
    </div>
  );
}
