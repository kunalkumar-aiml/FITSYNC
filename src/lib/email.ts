import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isProduction } from "./env";

/**
 * Transactional email.
 *
 * Providers (EMAIL_PROVIDER, or picked automatically):
 *  - resend   RESEND_API_KEY + EMAIL_FROM. The only provider that delivers real mail.
 *  - console  development only: the message (with its link) is printed to the server log. Refused in production.
 *  - outbox   automated tests only: messages are written as JSON files to EMAIL_OUTBOX_DIR. Needs ALLOW_TEST_EMAIL_OUTBOX=true
 *             and is refused on Vercel.
 * With no working provider, sending returns { status: "unavailable" } and the UI says so plainly.
 * FITSYNC never claims an email was sent when it was not.
 */
export type EmailMessage = { to: string; subject: string; text: string; html: string };
export type DeliveryStatus = "sent" | "logged" | "outbox" | "unavailable";
export type EmailResult = { status: DeliveryStatus; reason?: string };
type Provider = "resend" | "console" | "outbox" | "none";

export function emailProvider(): Provider {
  const explicit = process.env.EMAIL_PROVIDER as Provider | undefined;
  const resendReady = !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
  if (explicit === "resend") return resendReady ? "resend" : "none";
  if (explicit === "outbox") return process.env.ALLOW_TEST_EMAIL_OUTBOX === "true" && !process.env.VERCEL && !!process.env.EMAIL_OUTBOX_DIR ? "outbox" : "none";
  if (explicit === "console") return isProduction() ? "none" : "console";
  if (resendReady) return "resend";
  return isProduction() ? "none" : "console";
}

export const emailConfigured = () => emailProvider() !== "none";

export async function sendEmail(msg: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<EmailResult> {
  const provider = emailProvider();
  if (provider === "none") return { status: "unavailable", reason: "Email delivery is not configured on this server." };
  if (provider === "console") {
    console.info(`\n[dev-email] (not delivered; development only)\nTo: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n`);
    return { status: "logged" };
  }
  if (provider === "outbox") {
    const dir = process.env.EMAIL_OUTBOX_DIR!;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${Date.now()}-${Math.random().toString(36).slice(2)}.json`), JSON.stringify(msg));
    return { status: "outbox" };
  }
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[email] provider rejected the message", res.status);
      return { status: "unavailable", reason: "The email provider did not accept the message." };
    }
    return { status: "sent" };
  } catch (e) {
    console.error("[email] provider unreachable", (e as Error).message);
    return { status: "unavailable", reason: "The email provider could not be reached." };
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string, cta: { href: string; label: string }, foot: string) {
  return `<!doctype html><html><body style="margin:0;background:#F5F1E8;font-family:Helvetica,Arial,sans-serif;color:#24251F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #DDD5C8">
<tr><td style="padding:32px 36px 8px;font-family:Georgia,serif;font-size:22px;letter-spacing:.04em">FITSYNC</td></tr>
<tr><td style="padding:8px 36px 0;font-family:Georgia,serif;font-size:26px;line-height:1.2">${esc(title)}</td></tr>
<tr><td style="padding:16px 36px 0;font-size:15px;line-height:1.6">${body}</td></tr>
<tr><td style="padding:24px 36px"><a href="${esc(cta.href)}" style="display:inline-block;background:#405344;color:#FFFFFF;text-decoration:none;padding:12px 20px;font-size:15px">${esc(cta.label)}</a></td></tr>
<tr><td style="padding:0 36px 32px;font-size:13px;line-height:1.6;color:#5C5F55">${foot}</td></tr>
</table></td></tr></table></body></html>`;
}

export function verificationEmail(to: string, link: string): EmailMessage {
  return {
    to, subject: "Confirm your email for FITSYNC",
    text: `Confirm your email address to finish setting up FITSYNC:\n\n${link}\n\nThe link works once and expires in 24 hours. If you did not create a FITSYNC account, ignore this email.`,
    html: layout("Confirm your email", "Confirm this address to finish setting up your FITSYNC account.", { href: link, label: "Confirm email" },
      `The link works once and expires in 24 hours. If you did not create a FITSYNC account, you can ignore this email.<br><br>${esc(link)}`),
  };
}

export function resetEmail(to: string, link: string): EmailMessage {
  return {
    to, subject: "Reset your FITSYNC password",
    text: `Someone asked to reset the password for this FITSYNC account. To choose a new password, open:\n\n${link}\n\nThe link works once and expires in 1 hour. After the reset, every device is signed out. If this wasn't you, ignore this email: your password stays the same.`,
    html: layout("Reset your password", "Someone asked to reset the password for this FITSYNC account. Choose a new password with the link below.", { href: link, label: "Choose a new password" },
      `The link works once and expires in 1 hour. After the reset, every device is signed out. If this wasn't you, ignore this email: your password stays the same.<br><br>${esc(link)}`),
  };
}
