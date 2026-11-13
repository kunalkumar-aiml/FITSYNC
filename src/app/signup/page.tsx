import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
export const metadata = { title: "Create account" };
export default function Page() {
  return (
    <AuthShell title="Create your fit profile" lede="Free. Next you’ll add your measurements, which takes about five minutes." foot={<>Already have an account? <Link href="/login" className="link text-ink">Log in</Link></>}>
      <Suspense><AuthForm mode="signup" /></Suspense>
    </AuthShell>
  );
}
