import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { VerifyEmail } from "@/components/account-recovery";
export const metadata = { title: "Confirm your email", referrer: "no-referrer" };
// The token is only used after a click, so email security scanners that open links can't use it up.
export default function Page() {
  return <AuthShell title="Confirm your email" lede="One click and your address is verified."><Suspense><VerifyEmail /></Suspense></AuthShell>;
}
