import { issueToken } from "./auth-tokens";
import { sendEmail, verificationEmail, type DeliveryStatus } from "./email";
import { appUrl } from "./env";
import { logAuthEvent } from "./audit";

/** Issue a verification token and email it. The result says honestly whether the email went anywhere. */
export async function sendVerification(user: { id: string; email: string }, req: Request): Promise<{ delivery: DeliveryStatus; message: string }> {
  const token = await issueToken(user.id, user.email, "EMAIL_VERIFICATION");
  const link = `${appUrl(new URL(req.url).origin)}/verify-email?token=${encodeURIComponent(token)}`;
  const res = await sendEmail(verificationEmail(user.email, link));
  if (res.status !== "unavailable") await logAuthEvent("EMAIL_VERIFICATION_SENT", { userId: user.id });
  const message = {
    sent: `We sent a confirmation link to ${user.email}. It expires in 24 hours.`,
    logged: "Development mode: the confirmation link was written to the server console instead of being emailed.",
    outbox: "Test mode: the confirmation email was written to the test outbox.",
    unavailable: "We couldn’t send a confirmation email because email delivery is not configured on this server. You can keep using FITSYNC; try again later from your dashboard.",
  }[res.status];
  return { delivery: res.status, message };
}
