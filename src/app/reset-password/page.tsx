import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "@/components/account-recovery";
export const metadata = { title: "Choose a new password", referrer: "no-referrer" };
export default function Page() {
  return <AuthShell title="Choose a new password"><Suspense><ResetForm /></Suspense></AuthShell>;
}
