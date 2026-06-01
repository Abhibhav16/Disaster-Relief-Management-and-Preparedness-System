import nodemailer from "nodemailer";
import { env } from "../config/env";

export async function sendEmail(to: string, subject: string, text: string) {
  if (!env.SMTP_HOST) {
    console.log(`[email placeholder] to=${to} subject=${subject} text=${text}`);
    return;
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
  });

  await transport.sendMail({ from: env.EMAIL_FROM, to, subject, text });
}

