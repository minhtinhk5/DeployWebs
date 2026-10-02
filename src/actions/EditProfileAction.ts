"use server";

import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User } from "@/database/entity/User.entity";
import { Profile } from "@/database/entity/Profile.entity";
import { NEXT_AUTH } from "@/services/NextAuth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import z from "zod";

const schema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  dateOfBirth: z.string().trim().max(20),
  gender: z.enum(["Male", "Female", "Others"]),
  contactNumber: z.string().trim().min(9).max(20),
  about: z.string().trim().max(500),
});

export async function EditProfileAction(data: FormData) {
  const session = await getServerSession(NEXT_AUTH);
  if (!session?.user?.id) return;

  const parsed = schema.safeParse({
    firstName: data.get("firstName"),
    lastName: data.get("lastName"),
    dateOfBirth: data.get("dateOfBirth"),
    gender: data.get("gender"),
    contactNumber: data.get("contactNumber"),
    about: data.get("about"),
  });

  if (!parsed.success) {
    console.warn("EditProfile invalid input", parsed.error.issues);
    return;
  }

  try {
    // SỬA: bản cũ không gọi InitializeDatabase => lỗi khi DB chưa kết nối
    await InitializeDatabase();

    const userRepo = AppDataSource.getRepository(User);
    const profileRepo = AppDataSource.getRepository(Profile);

    const user = await userRepo.findOne({
      where: { id: session.user.id },
      relations: ["additionalInformation"],
    });
    if (!user) return;

    // SỬA: tự tạo profile nếu tài khoản cũ chưa có (trước đây crash ở đây)
    const profile = user.additionalInformation ?? new Profile();

    const input = parsed.data;
    user.firstName = input.firstName;
    user.lastName = input.lastName;
    user.contactNumber = input.contactNumber;

    profile.gender = input.gender as Profile["gender"];
    profile.dateOfBirth = input.dateOfBirth;
    profile.about = input.about;

    user.additionalInformation = await profileRepo.save(profile);
    await userRepo.save(user);
  } catch (error) {
    console.error(error);
    return;
  }

  revalidatePath("/dashboard/my-profile");
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/my-profile");
}
