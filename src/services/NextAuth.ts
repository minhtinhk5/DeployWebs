import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User as UserEntity, AccountType } from "@/database/entity/User.entity";
import { Profile } from "@/database/entity/Profile.entity";
import bcrypt from "bcrypt";
import crypto from "crypto";
import z from "zod";
import type { NextAuthOptions, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { hashPassword } from "@/utils/security";
import { escapeHtml, notifyAdmin, sendToChat, tgTime } from "@/services/Telegram";

/**
 * Tìm user theo email, nếu chưa có thì tạo mới (dùng cho đăng nhập Google/GitHub).
 * Bản cũ không lưu user OAuth vào DB nên session.user.id là id của Google/GitHub
 * => trang profile/settings bị lỗi.
 */
async function findOrCreateOAuthUser(
  email: string,
  name?: string | null,
  image?: string | null,
  provider?: string
) {
  await InitializeDatabase();
  const repo = AppDataSource.getRepository(UserEntity);

  const existing = await repo.findOne({ where: { email } });
  if (existing) {
    if (!existing.isSignedIn) {
      // Email đã được Google/GitHub xác minh
      existing.isSignedIn = true;
      existing.verificationOtp = null;
      await repo.save(existing);
    }
    return existing;
  }

  const [firstName, ...rest] = (name || email.split("@")[0]).trim().split(" ");
  const lastName = rest.join(" ") || "-";

  const profile = await AppDataSource.getRepository(Profile).save(new Profile());

  const user = new UserEntity();
  user.email = email;
  user.firstName = firstName;
  user.lastName = lastName;
  user.accountType = AccountType.STUDENT;
  user.contactNumber = "";
  user.isSignedIn = true;
  user.password = await hashPassword(crypto.randomBytes(32).toString("hex"));
  user.image =
    image ||
    `https://api.dicebear.com/5.x/initials/svg?seed=${encodeURIComponent(
      `${firstName} ${lastName}`
    )}`;
  user.additionalInformation = profile;

  const saved = await repo.save(user);

  void notifyAdmin(
    `🎉 <b>Người dùng mới (${escapeHtml(provider)})</b>\n` +
      `👤 ${escapeHtml(firstName)} ${escapeHtml(lastName)}\n` +
      `📧 ${escapeHtml(email)}\n🕒 ${tgTime()}`
  );

  return saved;
}

export const NEXT_AUTH: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "Email" },
        password: { label: "Password", type: "password", placeholder: "Password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({
            email: z.string().trim().toLowerCase().email(),
            password: z.string().min(1),
          })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        await InitializeDatabase();

        const user = await AppDataSource.getRepository(UserEntity).findOne({
          where: { email },
        });

        if (!user || !user.isSignedIn || user.active === false) return null;

        if (!(await bcrypt.compare(password, user.password))) return null;

        return {
          id: user.id,
          email: user.email,
          accountType: user.accountType,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET!,
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") return true;

      if (!user.email) {
        return `/errorPage/${encodeURIComponent(
          "Tài khoản không có email công khai, không thể đăng nhập"
        )}`;
      }

      const dbUser = await findOrCreateOAuthUser(
        user.email.toLowerCase(),
        user.name,
        user.image,
        account.provider
      );

      if (dbUser.active === false) return false;
      return true;
    },

    async jwt({ token, user, account }: { token: JWT; user?: User; account?: any }) {
      if (user) {
        if (account && account.provider !== "credentials") {
          // Lấy id/role thật trong DB cho user OAuth
          await InitializeDatabase();
          const dbUser = await AppDataSource.getRepository(UserEntity).findOne({
            where: { email: user.email!.toLowerCase() },
          });
          token.id = dbUser?.id;
          token.accountType = dbUser?.accountType;
          token.email = dbUser?.email;
        } else {
          token.id = user.id;
          token.accountType = user.accountType;
          token.email = user.email;
        }
      }
      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      session.user.id = token.id as string;
      session.user.accountType = token.accountType as Session["user"]["accountType"];
      session.user.email = token.email as string;
      return session;
    },
  },
  events: {
    // Cảnh báo đăng nhập qua Telegram (nếu người dùng đã liên kết & bật)
    async signIn({ user, account }) {
      try {
        if (!user.email) return;
        await InitializeDatabase();
        const dbUser = await AppDataSource.getRepository(UserEntity).findOne({
          where: { email: user.email.toLowerCase() },
        });
        if (!dbUser?.telegramChatId || !dbUser.telegramLoginAlert) return;

        void sendToChat(
          dbUser.telegramChatId,
          `🔐 <b>Đăng nhập mới vào StudyNotion</b>\n` +
            `📧 ${escapeHtml(dbUser.email)}\n` +
            `🔑 Phương thức: ${escapeHtml(account?.provider ?? "email")}\n` +
            `🕒 ${tgTime()}\n\n` +
            `Nếu không phải bạn, hãy đổi mật khẩu ngay.`
        );
      } catch (error) {
        console.warn("[telegram] login alert error", error);
      }
    },
  },
};
