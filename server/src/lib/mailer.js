import nodemailer from "nodemailer";
import { config } from "../config.js";

/**
 * One transport, built once. Unset SMTP_HOST is a valid state (see
 * .env.example) - it means development without real credentials - so this
 * stays null rather than throwing, and `sendOtpEmail` falls back to the
 * console when it's null.
 */
const transport = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined
    })
  : null;

export async function sendOtpEmail(to, code) {
  if (!transport) {
    console.log(`[lehra] SMTP not configured - verification code for ${to}: ${code}`);
    return;
  }

  await transport.sendMail({
    from: config.smtp.from,
    to,
    subject: "Your Lehra verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
    html:
      `<p>Your verification code is:</p>` +
      `<p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p>` +
      `<p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`
  });
}
