import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { InviteView } from "@/components/workspace/invite-view";

export const metadata: Metadata = { title: "Join workspace", robots: { index: false } };

// The token is only known at request time, so reading params happens inside Suspense; the
// surrounding layout still prerenders into the static shell.
export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      {params.then(({ token }) => (
        <InviteView token={token} />
      ))}
    </Suspense>
  );
}
