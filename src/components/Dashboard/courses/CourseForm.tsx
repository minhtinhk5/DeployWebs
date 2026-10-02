"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import toast from "react-hot-toast";
import {
  FiArrowDown,
  FiArrowUp,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiImage,
  FiPlus,
  FiTrash2,
  FiX,
} from "react-icons/fi";

export type Lecture = {
  title: string;
  description: string;
  videoUrl: string;
  timeDuration: string;
  isPreview: boolean;
};
export type SectionInput = { sectionName: string; lectures: Lecture[] };
export type CourseFormData = {
  id?: string;
  courseName: string;
  courseDescription: string;
  price: number;
  categoryId: string;
  newCategory: string;
  tag: string[];
  whatYouWillLearn: string;
  instructions: string[];
  thumbnailUrl: string;
  status: "Draft" | "Public";
  sections: SectionInput[];
};

type Category = { id: string; name: string };

const EMPTY: CourseFormData = {
  courseName: "",
  courseDescription: "",
  price: 0,
  categoryId: "",
  newCategory: "",
  tag: [],
  whatYouWillLearn: "",
  instructions: [],
  thumbnailUrl: "",
  status: "Draft",
  sections: [],
};

const emptyLecture = (): Lecture => ({
  title: "",
  description: "",
  videoUrl: "",
  timeDuration: "",
  isPreview: false,
});

const STEPS = ["Thông tin khóa học", "Nội dung khóa học", "Xuất bản"];

function move<T>(arr: T[], from: number, to: number) {
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export default function CourseForm({ initial }: { initial?: CourseFormData }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [data, setData] = useState<CourseFormData>(initial ?? EMPTY);
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [reqInput, setReqInput] = useState("");
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string>(initial?.thumbnailUrl ?? "");
  const [openSection, setOpenSection] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((res) => {
        if (res?.success) {
          const list: Category[] = res.categories.map((c: Category) => ({ id: c.id, name: c.name }));
          setCategories(list);
          if (!list.length) setUseNewCategory(true);
        }
      })
      .catch(() => setUseNewCategory(true));
  }, []);

  const set = <K extends keyof CourseFormData>(key: K, value: CourseFormData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  // ---------- tags & requirements ----------
  const addTag = () => {
    const t = tagInput.trim().replace(/,$/, "");
    if (t && !data.tag.includes(t) && data.tag.length < 20) set("tag", [...data.tag, t]);
    setTagInput("");
  };
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };
  const addReq = () => {
    const r = reqInput.trim();
    if (r) set("instructions", [...data.instructions, r]);
    setReqInput("");
  };

  // ---------- thumbnail ----------
  const onThumb = (file?: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Ảnh tối đa 5MB");
    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
  };

  // ---------- sections ----------
  const updateSection = (i: number, patch: Partial<SectionInput>) =>
    set(
      "sections",
      data.sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  const updateLecture = (si: number, li: number, patch: Partial<Lecture>) =>
    updateSection(si, {
      lectures: data.sections[si].lectures.map((l, idx) => (idx === li ? { ...l, ...patch } : l)),
    });
  const addSection = () => {
    set("sections", [...data.sections, { sectionName: "", lectures: [emptyLecture()] }]);
    setOpenSection(data.sections.length);
  };

  // ---------- validation ----------
  const validateInfo = () => {
    if (data.courseName.trim().length < 3) return "Tên khóa học tối thiểu 3 ký tự";
    if (data.courseDescription.trim().length < 10) return "Mô tả tối thiểu 10 ký tự";
    if (Number.isNaN(Number(data.price)) || Number(data.price) < 0) return "Giá không hợp lệ";
    if (useNewCategory ? !data.newCategory.trim() : !data.categoryId) return "Chọn hoặc nhập danh mục";
    if (data.whatYouWillLearn.trim().length < 5) return "Nhập lợi ích của khóa học";
    return null;
  };
  const validateContent = () => {
    for (let i = 0; i < data.sections.length; i++) {
      const s = data.sections[i];
      if (!s.sectionName.trim()) return `Chương ${i + 1} chưa có tên`;
      for (let j = 0; j < s.lectures.length; j++) {
      const l = s.lectures[j];
        if (!l.title.trim()) return `Bài ${j + 1} của chương ${i + 1} chưa có tiêu đề`;
        if (!/^https?:\/\/\S+$/.test(l.videoUrl.trim()))
          return `Bài ${j + 1} của chương ${i + 1}: link video không hợp lệ`;
      }
    }
    return null;
  };

  const goStep = (target: number) => {
    if (target > 0 && step === 0) {
      const err = validateInfo();
      if (err) return toast.error(err);
    }
    if (target > 1 && step <= 1) {
      const err = validateInfo() || validateContent();
      if (err) return toast.error(err);
    }
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const lectureCount = data.sections.reduce((n, s) => n + s.lectures.length, 0);

  // ---------- submit ----------
  const submit = async (status: "Draft" | "Public") => {
    const err = validateInfo() || validateContent();
    if (err) return toast.error(err);
    if (status === "Public" && lectureCount === 0)
      return toast.error("Cần ít nhất 1 bài học để xuất bản");

    const payload = {
      ...data,
      status,
      price: Number(data.price),
      categoryId: useNewCategory ? "" : data.categoryId,
      newCategory: useNewCategory ? data.newCategory : "",
    };
    const form = new FormData();
    form.append("data", JSON.stringify(payload));
    if (thumbFile) form.append("thumbnail", thumbFile);

    setSaving(true);
    const t = toast.loading("Đang lưu...");
    try {
      const res = await fetch(isEdit ? `/api/courses/${initial!.id}` : "/api/courses", {
        method: isEdit ? "PUT" : "POST",
        body: form,
      }).then((r) => r.json());

      toast.dismiss(t);
      if (!res?.success) return toast.error(res?.message || "Lưu thất bại");

      toast.success(status === "Public" ? "Đã xuất bản khóa học 🎉" : "Đã lưu bản nháp");
      router.push("/dashboard/my-courses");
      router.refresh();
    } catch {
      toast.dismiss(t);
      toast.error("Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const card = "rounded-md border border-richblack-700 bg-richblack-800 p-6 md:p-8";
  const label = "mb-1 block text-sm text-richblack-5";
  const req = <sup className="text-pink-200">*</sup>;

  return (
    <div className="text-richblack-5">
      {/* Stepper */}
      <div className="mb-10 flex items-center">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              onClick={() => (isEdit || i < step ? setStep(i) : goStep(i))}
              className="flex flex-col items-center gap-2"
            >
              <span
                className={`grid h-10 w-10 place-items-center rounded-full border text-sm font-semibold ${
                  i < step
                    ? "border-yellow-50 bg-yellow-50 text-richblack-900"
                    : i === step
                    ? "border-yellow-50 bg-yellow-900 text-yellow-50"
                    : "border-richblack-700 bg-richblack-800 text-richblack-300"
                }`}
              >
                {i < step ? <FiCheck /> : i + 1}
              </span>
              <span
                className={`hidden text-xs sm:block ${
                  i === step ? "text-richblack-5" : "text-richblack-400"
                }`}
              >
                {s}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-2 mb-6 h-0 flex-1 border-t-2 border-dashed ${
                  i < step ? "border-yellow-50" : "border-richblack-600"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* ============ STEP 1 ============ */}
      {step === 0 && (
        <div className={`${card} flex flex-col gap-6`}>
          <div>
            <label className={label}>Tên khóa học {req}</label>
            <input
              className="form-style w-full"
              value={data.courseName}
              maxLength={200}
              onChange={(e) => set("courseName", e.target.value)}
              placeholder="VD: Lập trình Next.js từ A-Z"
            />
          </div>

          <div>
            <label className={label}>Mô tả ngắn {req}</label>
            <textarea
              className="form-style min-h-[120px] w-full"
              value={data.courseDescription}
              onChange={(e) => set("courseDescription", e.target.value)}
              placeholder="Khóa học này nói về..."
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className={label}>Giá (VNĐ) {req}</label>
              <input
                type="number"
                min={0}
                step={1000}
                className="form-style w-full"
                value={data.price}
                onChange={(e) => set("price", Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-richblack-400">Nhập 0 nếu miễn phí</p>
            </div>

            <div>
              <label className={label}>Danh mục {req}</label>
              {!useNewCategory ? (
                <select
                  className="form-style w-full"
                  value={data.categoryId}
                  onChange={(e) => set("categoryId", e.target.value)}
                >
                  <option value="">-- Chọn danh mục --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-style w-full"
                  value={data.newCategory}
                  maxLength={100}
                  onChange={(e) => set("newCategory", e.target.value)}
                  placeholder="VD: Web Development"
                />
              )}
              {categories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUseNewCategory((v) => !v)}
                  className="mt-1 text-xs text-blue-100"
                >
                  {useNewCategory ? "← Chọn danh mục có sẵn" : "+ Tạo danh mục mới"}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className={label}>Thẻ (tags)</label>
            <div className="flex flex-wrap gap-2 pb-2">
              {data.tag.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-1 text-sm text-richblack-5"
                >
                  {t}
                  <button type="button" onClick={() => set("tag", data.tag.filter((x) => x !== t))}>
                    <FiX />
                  </button>
                </span>
              ))}
            </div>
            <input
              className="form-style w-full"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKey}
              onBlur={addTag}
              placeholder="Gõ rồi nhấn Enter, VD: javascript"
            />
          </div>

          <div>
            <label className={label}>Ảnh bìa</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onThumb(e.dataTransfer.files?.[0]);
              }}
              className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-richblack-500 bg-richblack-700 p-4"
            >
              {thumbPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbPreview} alt="thumbnail" className="max-h-[260px] rounded-md object-cover" />
              ) : (
                <>
                  <FiImage className="text-4xl text-yellow-50" />
                  <p className="text-sm text-richblack-200">
                    Kéo thả ảnh hoặc <span className="font-semibold text-yellow-50">bấm để chọn</span>
                  </p>
                  <p className="text-xs text-richblack-400">Tỉ lệ 16:9, tối đa 5MB</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => onThumb(e.target.files?.[0])}
            />
            {thumbPreview && (
              <button
                type="button"
                className="mt-2 text-xs text-pink-200"
                onClick={() => {
                  setThumbFile(null);
                  setThumbPreview("");
                  set("thumbnailUrl", "");
                }}
              >
                Xóa ảnh
              </button>
            )}
          </div>

          <div>
            <label className={label}>Học viên sẽ học được gì {req}</label>
            <textarea
              className="form-style min-h-[120px] w-full"
              value={data.whatYouWillLearn}
              onChange={(e) => set("whatYouWillLearn", e.target.value)}
              placeholder={"Mỗi ý một dòng, VD:\n- Hiểu App Router\n- Kết nối database"}
            />
          </div>

          <div>
            <label className={label}>Yêu cầu / Hướng dẫn</label>
            <ul className="mb-2 flex flex-col gap-1">
              {data.instructions.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-richblack-100">
                  • {r}
                  <button
                    type="button"
                    className="text-pink-200"
                    onClick={() => set("instructions", data.instructions.filter((_, idx) => idx !== i))}
                  >
                    <FiX />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                className="form-style flex-1"
                value={reqInput}
                onChange={(e) => setReqInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addReq();
                  }
                }}
                placeholder="VD: Biết HTML, CSS cơ bản"
              />
              <button
                type="button"
                onClick={addReq}
                className="rounded-md bg-richblack-700 px-4 font-semibold text-yellow-50"
              >
                Thêm
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => goStep(1)}
              className="flex items-center gap-2 rounded-md bg-yellow-50 px-5 py-2 font-semibold text-richblack-900"
            >
              Tiếp theo <FiChevronRight />
            </button>
          </div>
        </div>
      )}

      {/* ============ STEP 2 ============ */}
      {step === 1 && (
        <div className={`${card} flex flex-col gap-5`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Nội dung khóa học</h2>
            <span className="text-sm text-richblack-300">
              {data.sections.length} chương • {lectureCount} bài học
            </span>
          </div>

          {data.sections.length === 0 && (
            <p className="rounded-md border border-dashed border-richblack-600 p-6 text-center text-richblack-300">
              Chưa có chương nào. Bấm <b>Thêm chương</b> để bắt đầu.
            </p>
          )}

          {data.sections.map((s, si) => (
            <div key={si} className="rounded-md border border-richblack-600 bg-richblack-700/40">
              <div className="flex items-center gap-2 border-b border-richblack-600 p-3">
                <button
                  type="button"
                  onClick={() => setOpenSection(openSection === si ? null : si)}
                  className="text-richblack-300"
                >
                  {openSection === si ? <FiChevronDown /> : <FiChevronRight />}
                </button>
                <span className="text-sm text-richblack-400">Chương {si + 1}</span>
                <input
                  className="flex-1 rounded bg-transparent px-2 py-1 font-semibold outline-none focus:bg-richblack-700"
                  value={s.sectionName}
                  onChange={(e) => updateSection(si, { sectionName: e.target.value })}
                  placeholder="Tên chương"
                />
                <button type="button" title="Lên" onClick={() => set("sections", move(data.sections, si, si - 1))}>
                  <FiArrowUp className="text-richblack-300" />
                </button>
                <button type="button" title="Xuống" onClick={() => set("sections", move(data.sections, si, si + 1))}>
                  <FiArrowDown className="text-richblack-300" />
                </button>
                <button
                  type="button"
                  title="Xóa chương"
                  onClick={() => {
                    if (confirm(`Xóa chương "${s.sectionName || si + 1}" và toàn bộ bài học?`))
                      set("sections", data.sections.filter((_, idx) => idx !== si));
                  }}
                >
                  <FiTrash2 className="text-pink-200" />
                </button>
              </div>

              {openSection === si && (
                <div className="flex flex-col gap-4 p-4">
                  {s.lectures.map((l, li) => (
                    <div key={li} className="rounded-md border border-richblack-600 bg-richblack-800 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-yellow-50">Bài {li + 1}</span>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => updateSection(si, { lectures: move(s.lectures, li, li - 1) })}
                          >
                            <FiArrowUp className="text-richblack-300" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSection(si, { lectures: move(s.lectures, li, li + 1) })}
                          >
                            <FiArrowDown className="text-richblack-300" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateSection(si, { lectures: s.lectures.filter((_, idx) => idx !== li) })
                            }
                          >
                            <FiTrash2 className="text-pink-200" />
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                        <input
                          className="form-style"
                          value={l.title}
                          onChange={(e) => updateLecture(si, li, { title: e.target.value })}
                          placeholder="Tiêu đề bài học *"
                        />
                        <input
                          className="form-style"
                          value={l.timeDuration}
                          onChange={(e) => updateLecture(si, li, { timeDuration: e.target.value })}
                          placeholder="Thời lượng (10:30)"
                        />
                      </div>
                      <input
                        className="form-style mt-3 w-full"
                        value={l.videoUrl}
                        onChange={(e) => updateLecture(si, li, { videoUrl: e.target.value })}
                        placeholder="Link video * (YouTube, Google Drive, Cloudinary...)"
                      />
                      <textarea
                        className="form-style mt-3 w-full"
                        rows={2}
                        value={l.description}
                        onChange={(e) => updateLecture(si, li, { description: e.target.value })}
                        placeholder="Mô tả bài học (tuỳ chọn)"
                      />
                      <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-sm text-richblack-200">
                        <input
                          type="checkbox"
                          checked={l.isPreview}
                          onChange={(e) => updateLecture(si, li, { isPreview: e.target.checked })}
                          className="accent-yellow-50"
                        />
                        Cho xem thử miễn phí
                      </label>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateSection(si, { lectures: [...s.lectures, emptyLecture()] })}
                    className="flex w-fit items-center gap-2 text-sm font-semibold text-yellow-50"
                  >
                    <FiPlus /> Thêm bài học
                  </button>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addSection}
            className="flex w-fit items-center gap-2 rounded-md border border-yellow-50 px-4 py-2 font-semibold text-yellow-50"
          >
            <FiPlus /> Thêm chương
          </button>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded-md bg-richblack-700 px-5 py-2 font-semibold text-richblack-50"
            >
              Quay lại
            </button>
            <button
              type="button"
              onClick={() => goStep(2)}
              className="flex items-center gap-2 rounded-md bg-yellow-50 px-5 py-2 font-semibold text-richblack-900"
            >
              Tiếp theo <FiChevronRight />
            </button>
          </div>
        </div>
      )}

      {/* ============ STEP 3 ============ */}
      {step === 2 && (
        <div className={`${card} flex flex-col gap-6`}>
          <h2 className="text-xl font-semibold">Xem lại & xuất bản</h2>

          <div className="flex flex-col gap-4 md:flex-row">
            {thumbPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbPreview} alt="" className="h-[140px] w-full rounded-md object-cover md:w-[240px]" />
            ) : (
              <div className="grid h-[140px] w-full place-items-center rounded-md bg-richblack-700 text-richblack-400 md:w-[240px]">
                <FiImage className="text-3xl" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold">{data.courseName}</p>
              <p className="line-clamp-3 text-sm text-richblack-300">{data.courseDescription}</p>
              <p className="mt-1 text-yellow-50">
                {Number(data.price) === 0 ? "Miễn phí" : `${Number(data.price).toLocaleString("vi-VN")} ₫`}
              </p>
              <p className="text-sm text-richblack-300">
                {data.sections.length} chương • {lectureCount} bài học
              </p>
            </div>
          </div>

          <div className="rounded-md bg-richblack-700 p-4 text-sm text-richblack-200">
            • <b>Lưu nháp</b>: chỉ bạn thấy, có thể sửa tiếp.
            <br />• <b>Xuất bản</b>: khóa học được công khai, admin nhận thông báo qua Telegram.
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-md bg-richblack-700 px-5 py-2 font-semibold text-richblack-50"
            >
              Quay lại
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => submit("Draft")}
                className="rounded-md border border-richblack-500 px-5 py-2 font-semibold text-richblack-50 disabled:opacity-50"
              >
                Lưu nháp
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => submit("Public")}
                className="rounded-md bg-yellow-50 px-5 py-2 font-semibold text-richblack-900 disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Xuất bản"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
