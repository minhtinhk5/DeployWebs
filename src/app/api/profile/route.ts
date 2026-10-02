import { getServerSession } from "next-auth";
import { NEXT_AUTH } from "@/services/NextAuth";
import { NextResponse, type NextRequest } from "next/server";
import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User } from "@/database/entity/User.entity";
import { CloudinaryConnect, uploadImageToCloudinary } from "@/services/Cloudinary";
import { toPublicUser } from "@/utils/security";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

async function getSessionUser(withProfile = false) {
  const session = await getServerSession(NEXT_AUTH);
  if (!session?.user?.id) return null;

  await InitializeDatabase();
  return AppDataSource.getRepository(User).findOne({
    where: { id: session.user.id },
    relations: withProfile ? ["additionalInformation"] : [],
  });
}

/** Đổi ảnh đại diện */
export const PUT = async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { success: false, message: "Route is reserved for users only" },
      { status: 401 }
    );
  }

  const formData = await req.formData();
  const displayPicture = formData.get("displayPicture");

  if (!displayPicture || typeof displayPicture === "string") {
    return NextResponse.json({ success: false, message: "No File Provided" });
  }

  if (!ALLOWED_TYPES.includes(displayPicture.type)) {
    return NextResponse.json({ success: false, message: "Chỉ chấp nhận ảnh PNG, JPG, GIF, WEBP" });
  }

  if (displayPicture.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ success: false, message: "Ảnh tối đa 5MB" });
  }

  const buffer = Buffer.from(await displayPicture.arrayBuffer());

  await CloudinaryConnect();

  let image: { secure_url: string } | null = null;
  try {
    image = await uploadImageToCloudinary(buffer, process.env.FOLDER_NAME!, 1000, 1000);
  } catch (error) {
    console.error(error);
  }

  if (!image) {
    return NextResponse.json({ success: false, message: "Error while uploading image" });
  }

  user.image = image.secure_url;
  await AppDataSource.getRepository(User).save(user);

  return NextResponse.json({
    success: true,
    message: "Picture changed successfully",
    image: image.secure_url,
  });
};

/**
 * Lấy thông tin của CHÍNH người đang đăng nhập.
 * SỬA LỖI BẢO MẬT: bản cũ nhận `id` bất kỳ từ body và trả về toàn bộ bản ghi
 * (gồm hash mật khẩu, OTP, token reset) cho bất kỳ ai gọi.
 */
async function getMe() {
  const user = await getSessionUser(true);
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    success: true,
    message: "User information fetched successfully",
    user: toPublicUser(user),
  });
}

export const GET = getMe;
export const POST = getMe; // giữ tương thích với code cũ
