import { CloudinaryConnect, uploadImageToCloudinary } from "@/services/Cloudinary";
import { courseSchema, type CourseInput } from "@/lib/courses";
import type { NextRequest } from "next/server";

const MAX_THUMB = 5 * 1024 * 1024;
const IMG_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

type Parsed =
  | { ok: true; input: CourseInput; thumbnail: string | null }
  | { ok: false; message: string };

/** Đọc form multipart: field "data" (JSON) + file "thumbnail" (tuỳ chọn) */
export async function parseCourseRequest(req: NextRequest): Promise<Parsed> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { ok: false, message: "Dữ liệu gửi lên không hợp lệ" };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data") ?? "{}"));
  } catch {
    return { ok: false, message: "Dữ liệu gửi lên không hợp lệ" };
  }

  const parsed = courseSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "Dữ liệu không hợp lệ" };
  }

  let thumbnail: string | null = null;
  const file = form.get("thumbnail");
  if (file && typeof file !== "string" && file.size > 0) {
    if (!IMG_TYPES.includes(file.type)) return { ok: false, message: "Ảnh bìa phải là PNG/JPG/WEBP/GIF" };
    if (file.size > MAX_THUMB) return { ok: false, message: "Ảnh bìa tối đa 5MB" };
    try {
      await CloudinaryConnect();
      const res = await uploadImageToCloudinary(
        Buffer.from(await file.arrayBuffer()),
        process.env.FOLDER_NAME || "studynotion"
      );
      thumbnail = res?.secure_url ?? null;
    } catch (e) {
      console.error("Upload thumbnail lỗi", e);
      return { ok: false, message: "Không tải được ảnh bìa lên Cloudinary" };
    }
  } else if (parsed.data.thumbnailUrl && /^https?:\/\//.test(parsed.data.thumbnailUrl)) {
    thumbnail = parsed.data.thumbnailUrl;
  }

  return { ok: true, input: parsed.data, thumbnail };
}
