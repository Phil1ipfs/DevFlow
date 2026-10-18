"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@/lib/query";
import { MailWarning, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, FormAlert } from "@/components/auth/auth-card";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { Button } from "@/components/ui/button";
import { isApiError } from "@/lib/api/client";
import { invitationPreviewQuery, useAcceptInvitation } from "@/lib/api/organizations";
import { useCurrentUser, useLogout } from "@/lib/auth/auth-api";
import { useSwitchOrganization } from "./organization-provider";

const STATUS_MESSAGE = {
  Accepted: "This invitation has already been used.",
  Revoked: "This invitation was withdrawn by an admin.",
  Expired: "This invitation has expired.",
} as const;

export function InviteView({ token }: { token: string }) {
  const router = useRouter();
  const preview = useQuery({ ...invitationPreviewQuery(token), retry: false });
  const { user, isPending: userPending } = useCurrentUser();
  const accept = useAcceptInvitation(token);
  const logout = useLogout();
  const setActive = useSwitchOrganization();
  const next = encodeURIComponent(`/invite/${token}`);

  if (preview.isPending || userPending) return <AuthFormSkeleton />;

  if (preview.isError) {
    return (
      <AuthCard title="Invitation not found" footer={<Link href="/" className="font-medium text-primary hover:underline">Go to DevFlow</Link>}>
        <p className="text-sm text-muted-foreground">
          {isApiError(preview.error, 404)
            ? "This link is invalid. Check that you copied the whole link from the email."
            : preview.error.message}
        </p>
      </AuthCard>
    );
  }

  const invitation = preview.data;
  const role = invitation.role.toLowerCase();

  if (invitation.status !== "Pending") {
    return (
      <AuthCard title="Invitation unavailable" footer={<Link href="/app" className="font-medium text-primary hover:underline">Open DevFlow</Link>}>
        <p className="text-sm text-muted-foreground">
          {STATUS_MESSAGE[invitation.status]} Ask an admin of {invitation.organizationName} to send you a new one.
        </p>
      </AuthCard>
    );
  }

  const intro = (
    <div className="mb-5 flex items-start gap-3 rounded-lg bg-muted/60 p-3 text-sm">
      <UsersRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <p>
        <span className="font-medium">{invitation.invitedByName}</span> invited{" "}
        <span className="font-medium">{invitation.email}</span> to join as {role === "admin" ? "an admin" : "a member"}.
      </p>
    </div>
  );

  async function acceptInvitation() {
    try {
      const result = await accept.mutateAsync();
      setActive(result.organizationId);
      toast.success(`You joined ${result.organizationName}`);
      router.replace("/app");
    } catch {
      // The error message is rendered below from accept.error.
    }
  }

  if (!user) {
    return (
      <AuthCard title={`Join ${invitation.organizationName}`} description="Sign in or create an account to accept.">
        {intro}
        <div className="grid gap-2">
          <Button asChild size="lg">
            <Link href={`/register?next=${next}`}>Create an account</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={`/login?next=${next}`}>I already have an account</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  const wrongAccount = user.email.toLowerCase() !== invitation.email.toLowerCase();

  return (
    <AuthCard title={`Join ${invitation.organizationName}`}>
      {intro}
      {wrongAccount ? (
        <div className="space-y-4 text-sm">
          <div className="flex gap-2.5 text-muted-foreground">
            <MailWarning className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <p>
              You&apos;re signed in as <span className="font-medium text-foreground">{user.email}</span>. This invitation
              can only be accepted by <span className="font-medium text-foreground">{invitation.email}</span>.
            </p>
          </div>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            disabled={logout.isPending}
            onClick={async () => {
              await logout.mutateAsync().catch(() => undefined);
              router.push(`/login?next=${next}`);
            }}
          >
            Sign in with a different account
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <FormAlert message={accept.error ? accept.error.message : null} />
          <Button size="lg" className="w-full" onClick={acceptInvitation} disabled={accept.isPending}>
            {accept.isPending ? "Joining…" : `Join ${invitation.organizationName}`}
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
