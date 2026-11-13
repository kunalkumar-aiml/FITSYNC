import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
export const metadata = { title: "Log in" };
export default function Page() {
  return (
    <AuthShell title="Welcome back" lede="Log in to see your fit profile and recommendations." foot={<>New to FITSYNC? <Link href="/signup" className="link text-ink">Create an account</Link></>}>
      <Suspense><AuthForm mode="login" /></Suspense>
    </AuthShell>
  );
}
