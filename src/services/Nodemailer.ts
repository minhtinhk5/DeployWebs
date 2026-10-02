import nodemailer from "nodemailer";

const globalForMail = globalThis as unknown as {
  __mailer?: nodemailer.Transporter;
};

function getTransporter() {
  if (!globalForMail.__mailer) {
    const port = Number(process.env.MAIL_PORT) || 587;
    globalForMail.__mailer = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }
  return globalForMail.__mailer;
}

/**
 * Gửi email. Lỗi được NÉM RA để nơi gọi biết gửi thất bại
 * (bản cũ nuốt lỗi nên luôn báo "đã gửi OTP" dù không gửi được).
 */
export default async function mailer(email: string, title: string, body: string) {
  const from =
    process.env.MAIL_FROM || `"StudyNotion" <${process.env.MAIL_USER}>`;

  try {
    return await getTransporter().sendMail({ from, to: email, subject: title, html: body });
  } catch (error) {
    console.error("Something went wrong while sending mail.", error);
    throw error;
  }
}
