import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "@/components/account-recovery";
export const metadata = { title: "Reset your password" };
export default function Page() {
  return (
    <AuthShell title="Reset your password" lede="Enter the email you signed up with. If it has an account, we’ll send a link that works once and expires in an hour." foot={<Link href="/login" className="link text-ink">Back to log in</Link>}>
      <ForgotForm />
    </AuthShell>
  );
}
