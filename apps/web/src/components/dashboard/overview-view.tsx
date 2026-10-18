"use client";

import Link from "next/link";
import { useQuery } from "@/lib/query";
import { ArrowRight, Check, Circle } from "lucide-react";
import { initials } from "@/components/app-shell/user-menu";
import { PageHeader } from "@/components/app-shell/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/components/workspace/organization-provider";
import { membersQuery } from "@/lib/api/organizations";
import { projectsQuery } from "@/lib/api/projects";
import { myTasksQuery, TASK_STATUSES } from "@/lib/api/tasks";
import { DueDateLabel, PriorityIcon, StatusIcon } from "@/components/tasks/task-meta";
import { useCurrentUser } from "@/lib/auth/auth-api";
import { cn } from "@/lib/utils";
import { SystemHealthCard } from "./system-health-card";

function GettingStarted({ hasProject, hasTeammate, isAdmin }: { hasProject: boolean; hasTeammate: boolean; isAdmin: boolean }) {
  const steps = [
    { done: true, label: "Create your workspace" },
    { done: hasProject, label: "Create your first project", href: "/app/projects", adminOnly: true },
    { done: hasTeammate, label: "Invite a teammate", href: "/app/settings/members", adminOnly: true },
  ];
  if (steps.every((step) => step.done)) return null;

  return (
    <Card className="bg-brand-soft/40">
      <CardHeader>
        <CardTitle>Get your workspace ready</CardTitle>
        <CardDescription>{isAdmin ? "A few steps to set things up for your team." : "Your admins are still setting things up."}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 sm:grid-cols-3">
          {steps.map((step) => {
            const content = (
              <>
                {step.done ? (
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" aria-hidden />
                  </span>
                ) : (
                  <Circle className="size-5 text-muted-foreground" aria-hidden />
                )}
                <span className={cn(step.done && "text-muted-foreground line-through")}>{step.label}</span>
                <span className="sr-only">{step.done ? "(done)" : "(to do)"}</span>
              </>
            );
            const actionable = !step.done && step.href && (!step.adminOnly || isAdmin);
            return (
              <li key={step.label}>
                {actionable ? (
                  <Link href={step.href!} className="flex items-center gap-2.5 rounded-lg border bg-card p-3 text-sm font-medium hover:border-primary/40">
                    {content}
                    <ArrowRight className="ml-auto size-3.5 text-muted-foreground" aria-hidden />
                  </Link>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-lg border bg-card/60 p-3 text-sm">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

export function OverviewView() {
  const { user } = useCurrentUser();
  const { active, isAdmin } = useOrganization();
  const enabled = Boolean(active);
  const projects = useQuery({ ...projectsQuery(active?.id ?? ""), enabled });
  const members = useQuery({ ...membersQuery(active?.id ?? ""), enabled });
  const myTasks = useQuery({
    ...myTasksQuery(active?.id ?? "", { status: TASK_STATUSES.filter((s) => s !== "Done"), sort: "DueDate", pageSize: 6 }),
    enabled,
  });
  const firstName = user?.displayName.split(" ")[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Overview"}
        description={active ? `What's happening in ${active.name}.` : "Loading your workspace…"}
      />

      {projects.data && members.data && (
        <GettingStarted hasProject={projects.data.length > 0} hasTeammate={members.data.length > 1} isAdmin={isAdmin} />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="space-y-1.5">
                <CardTitle>My open tasks</CardTitle>
                <CardDescription>{myTasks.data ? `${myTasks.data.totalCount} assigned to you, soonest due first` : " "}</CardDescription>
              </div>
              <Link href="/app/my-tasks" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {myTasks.isPending ? (
                <div className="space-y-2" role="status" aria-label="Loading your tasks">
                  <Skeleton className="h-11" />
                  <Skeleton className="h-11" />
                </div>
              ) : myTasks.data?.items.length ? (
                <ul className="divide-y rounded-lg border">
                  {myTasks.data.items.map((task) => (
                    <li key={task.id}>
                      <Link
                        href={`/app/projects/${task.projectId}?task=${task.id}`}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50"
                      >
                        <StatusIcon status={task.status} />
                        <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{task.key}</span>
                        <span className="flex-1 truncate font-medium">{task.title}</span>
                        <DueDateLabel date={task.dueDate} done={false} className="hidden sm:inline-flex" />
                        <PriorityIcon priority={task.priority} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nothing assigned to you right now.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="space-y-1.5">
                <CardTitle>Projects</CardTitle>
                <CardDescription>
                  {projects.data ? `${projects.data.length} active ${projects.data.length === 1 ? "project" : "projects"}` : " "}
                </CardDescription>
              </div>
              <Link href="/app/projects" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {projects.isPending ? (
                <div className="space-y-2" role="status" aria-label="Loading projects">
                  <Skeleton className="h-11" />
                  <Skeleton className="h-11" />
                </div>
              ) : projects.data?.length ? (
                <ul className="divide-y rounded-lg border">
                  {projects.data.slice(0, 5).map((project) => (
                    <li key={project.id}>
                      <Link href={`/app/projects/${project.id}`} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50">
                        <span className="w-12 font-mono text-xs text-muted-foreground">{project.key}</span>
                        <span className="flex-1 truncate font-medium">{project.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{project.openTaskCount} open</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No projects yet.{isAdmin && " Create one from the Projects page."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card size="sm">
            <CardHeader>
              <CardDescription>Members</CardDescription>
              <CardTitle className="text-base">{members.data ? `${members.data.length} in this workspace` : <Skeleton className="h-5 w-32" />}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="flex -space-x-2">
                {members.data?.slice(0, 6).map((member) => (
                  <Avatar key={member.userId} className="size-7 border-2 border-card" title={member.displayName}>
                    <AvatarFallback className="bg-secondary text-[10px]">{initials(member.displayName)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <Link href="/app/settings/members" className="text-xs font-medium text-primary hover:underline">
                {isAdmin ? "Manage" : "View"}
              </Link>
            </CardContent>
          </Card>
          <SystemHealthCard />
        </div>
      </div>
    </div>
  );
}
