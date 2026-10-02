"use server";

import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User, AccountType } from "@/database/entity/User.entity";
import { Profile } from "@/database/entity/Profile.entity";
import { redirect } from "next/navigation";
import z from "zod";
import mailer from "@/services/Nodemailer";
import { otpTemplate } from "@/mails/emailVerificationTemplate";
import { generateOtp, hashPassword, minutesFromNow } from "@/utils/security";

const OTP_TTL_MIN = 10;

const errorRedirect = (message: string): never =>
  redirect(`/errorPage/${encodeURIComponent(message)}`);

// SỬA LỖI BẢO MẬT: bản cũ cho phép gửi accountType = "Admin" khi đăng ký
// và bỏ qua validate với email đã tồn tại.
const userSchema = z
  .object({
    accountType: z.enum([AccountType.STUDENT, AccountType.INSTRUCTOR]),
    firstName: z.string().trim().min(1).max(50),
    lastName: z.string().trim().min(1).max(50),
    email: z.string().trim().toLowerCase().email("Please provide a proper email"),
    contactNumber: z.string().trim().min(9).max(20),
    password: z.string().min(6, "Password must be at least 6 characters").max(100),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password and Confirm Password must be the same",
    path: ["confirmPassword"],
  });

const SignupAction = async (formData: FormData) => {
  const parsed = userSchema.safeParse({
    accountType: formData.get("accountType"),
    email: formData.get("email"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    contactNumber: formData.get("contactNumber"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return errorRedirect(parsed.error.issues[0]?.message || "Wrong Inputs! Please ensure correct inputs");
  }

  const input = parsed.data;

  await InitializeDatabase();
  const userRepo = AppDataSource.getRepository(User);
  const profileRepo = AppDataSource.getRepository(Profile);

  let user = await userRepo.findOne({
    where: { email: input.email },
    relations: ["additionalInformation"],
  });

  if (user?.isSignedIn) {
    return errorRedirect("Email already registered");
  }

  const otp = generateOtp();

  try {
    await mailer(input.email, "StudyNotion Verification Email", otpTemplate(otp));
  } catch {
    return errorRedirect("Problem while sending OTP");
  }

  let failed = false;
  try {
    if (!user) user = new User();

    user.accountType = input.accountType;
    user.firstName = input.firstName;
    user.lastName = input.lastName;
    user.email = input.email;
    user.contactNumber = input.contactNumber;
    user.password = await hashPassword(input.password);
    user.verificationOtp = otp;
    user.otpExpires = minutesFromNow(OTP_TTL_MIN);
    user.image = `https://api.dicebear.com/5.x/initials/svg?seed=${encodeURIComponent(
      `${input.firstName} ${input.lastName}`
    )}`;

    // SỬA: khóa ngoại nằm ở bảng users (additionalInformationId).
    // Bản cũ chỉ gán profile.user nên profile không bao giờ được liên kết
    // => trang Edit Profile bị crash.
    if (!user.additionalInformation) {
      user.additionalInformation = await profileRepo.save(new Profile());
    }

    await userRepo.save(user);
  } catch (error) {
    console.error(error);
    failed = true;
  }

  if (failed) return errorRedirect("Problem while signup! Try again later");

  redirect(`/auth/otp-verification/${encodeURIComponent(input.email)}`);
};

export default SignupAction;
