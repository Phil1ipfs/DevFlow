import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <RegisterForm />
    </Suspense>
  );
}
