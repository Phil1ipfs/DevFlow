import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";

export const metadata: Metadata = { title: "Choose a new password" };

export default function Page() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
