"use client";

import { useState } from "react";
import { useQuery } from "@/lib/query";
import { MailPlus, MoreHorizontal, UserMinus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { initials } from "@/components/app-shell/user-menu";
import { FormAlert } from "@/components/auth/auth-card";
import { FormField } from "@/components/forms/form-field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/components/workspace/organization-provider";
import { isApiError } from "@/lib/api/client";
import {
  invitationsQuery,
  membersQuery,
  useChangeMemberRole,
  useInvite,
  useRemoveMember,
  useRevokeInvitation,
  type Member,
  type OrganizationRole,
} from "@/lib/api/organizations";
import { useCurrentUser } from "@/lib/auth/auth-api";
import { applyServerErrors } from "@/lib/forms/server-errors";
import { zodResolver } from "@/lib/forms/zod-resolver";

const ROLES: OrganizationRole[] = ["Member", "Admin", "Owner"];

/** Mirrors the API's rules so the UI only offers allowed actions (the API still enforces them). */
function allowedRoles(callerRole: OrganizationRole, target: Member, isSelf: boolean): OrganizationRole[] {
  if (callerRole === "Owner") return ROLES;
  if (callerRole === "Admin" && target.role !== "Owner" && (target.role === "Member" || isSelf)) return ["Member", "Admin"];
  return [];
}

function canRemove(callerRole: OrganizationRole, target: Member, isSelf: boolean) {
  if (isSelf) return false; // Leaving is on the Workspace tab.
  if (callerRole === "Owner") return true;
  return callerRole === "Admin" && target.role === "Member";
}

function MemberRow({ member, callerRole, isSelf, organizationId }: { member: Member; callerRole: OrganizationRole; isSelf: boolean; organizationId: string }) {
  const changeRole = useChangeMemberRole(organizationId);
  const remove = useRemoveMember(organizationId);
  const roles = allowedRoles(callerRole, member, isSelf);
  const removable = canRemove(callerRole, member, isSelf);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "Something went wrong.");
    }
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <Avatar className="size-8">
        <AvatarFallback className="bg-secondary text-xs">{initials(member.displayName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.displayName} {isSelf && <span className="font-normal text-muted-foreground">(you)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </div>
      <Badge variant={member.role === "Member" ? "outline" : "secondary"}>{member.role}</Badge>
      {roles.length > 0 || removable ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Manage ${member.displayName}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {roles.length > 0 && (
              <>
                <DropdownMenuLabel>Role</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={member.role}
                  onValueChange={(role) =>
                    run(() => changeRole.mutateAsync({ userId: member.userId, role: role as OrganizationRole }), `${member.displayName} is now ${role}`)
                  }
                >
                  {roles.map((role) => (
                    <DropdownMenuRadioItem key={role} value={role}>
                      {role}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}
            {removable && (
              <>
                {roles.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => run(() => remove.mutateAsync(member.userId), `Removed ${member.displayName}`)}
                >
                  <UserMinus />
                  Remove from workspace
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="size-7" aria-hidden />
      )}
    </li>
  );
}

const inviteSchema = z.object({
  email: z.email("Enter a valid email address."),
  role: z.enum(["Member", "Admin"]),
});

function InviteDialog({ organizationId, open, onOpenChange }: { organizationId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const invite = useInvite(organizationId);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof inviteSchema>>({ resolver: zodResolver(inviteSchema), defaultValues: { email: "", role: "Member" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof inviteSchema>) {
    setFormError(null);
    try {
      await invite.mutateAsync(values);
      toast.success(`Invitation sent to ${values.email}`);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["email", "role"]));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>They&apos;ll get an email with a link that is valid for 7 days.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormAlert message={formError} />
          <FormField id="inviteEmail" label="Email" error={errors.email?.message}>
            <Input type="email" autoFocus placeholder="teammate@company.com" {...form.register("email")} />
          </FormField>
          <FormField id="inviteRole" label="Role" error={errors.role?.message} hint="Admins can manage projects, members and the helpdesk.">
            {(control) => (
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" {...control}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Member">Member</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PendingInvitations({ organizationId }: { organizationId: string }) {
  const { data: invitations } = useQuery(invitationsQuery(organizationId));
  const revoke = useRevokeInvitation(organizationId);
  if (!invitations?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invitations</CardTitle>
        <CardDescription>Invitations that haven&apos;t been accepted yet.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y border-t">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{invitation.email}</p>
                <p className="text-xs text-muted-foreground">
                  Invited by {invitation.invitedBy.displayName} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline">{invitation.role}</Badge>
              <Button
                variant="ghost"
                size="sm"
                disabled={revoke.isPending}
                onClick={async () => {
                  await revoke.mutateAsync(invitation.id);
                  toast.success(`Revoked the invitation for ${invitation.email}`);
                }}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function MembersPanel() {
  const { active, isAdmin } = useOrganization();
  const { user } = useCurrentUser();
  const [inviting, setInviting] = useState(false);
  const { data: members, isPending } = useQuery({ ...membersQuery(active?.id ?? ""), enabled: Boolean(active) });

  if (!active || !user) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>Members</CardTitle>
            <CardDescription>
              {members ? `${members.length} ${members.length === 1 ? "person" : "people"} in ${active.name}.` : "Loading…"}
            </CardDescription>
          </div>
          {isAdmin && (
            <Button onClick={() => setInviting(true)}>
              <MailPlus data-icon="inline-start" />
              Invite
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-0">
          {isPending ? (
            <div className="space-y-2 px-5" role="status" aria-label="Loading members">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <ul className="divide-y border-t">
              {members?.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  callerRole={active.role}
                  isSelf={member.userId === user.id}
                  organizationId={active.id}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {isAdmin && <PendingInvitations organizationId={active.id} />}
      {isAdmin && <InviteDialog organizationId={active.id} open={inviting} onOpenChange={setInviting} />}
    </div>
  );
}
