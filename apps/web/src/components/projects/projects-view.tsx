"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@/lib/query";
import { Archive, FolderKanban, Plus } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { PageHeader } from "@/components/app-shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/components/workspace/organization-provider";
import { projectsQuery, type Project } from "@/lib/api/projects";
import { CreateProjectDialog } from "./project-dialogs";

function ProjectCard({ project }: { project: Project }) {
  return (
    <li>
      <Link
        href={`/app/projects/${project.id}`}
        className="group flex h-full flex-col rounded-xl border bg-card p-4 transition-[border-color,box-shadow] outline-none hover:border-primary/35 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft font-mono text-xs font-semibold text-primary">
            {project.key.slice(0, 3)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium group-hover:text-primary">{project.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{project.key}</p>
          </div>
          {project.archivedAt && (
            <Badge variant="outline" className="text-muted-foreground">
              Archived
            </Badge>
          )}
        </div>
        <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted-foreground">{project.description || "No description."}</p>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>{project.lead ? `Lead: ${project.lead.displayName}` : "No lead"}</span>
          <span className="tabular-nums">
            {project.openTaskCount} open {project.openTaskCount === 1 ? "task" : "tasks"}
          </span>
        </div>
      </Link>
    </li>
  );
}

export function ProjectsView() {
  const { active, isAdmin } = useOrganization();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data: projects, isPending, isError, error, refetch } = useQuery({
    ...projectsQuery(active?.id ?? "", showArchived),
    enabled: Boolean(active),
  });

  const newProject = isAdmin && (
    <Button onClick={() => setCreating(true)}>
      <Plus data-icon="inline-start" />
      New project
    </Button>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects"
        description="Group work by product, team or initiative."
        actions={
          <>
            <Button variant="outline" onClick={() => setShowArchived((value) => !value)} aria-pressed={showArchived}>
              <Archive data-icon="inline-start" />
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
            {newProject}
          </>
        }
      />

      {!active || isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading projects">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          {error.message}{" "}
          <button className="font-medium text-primary hover:underline" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={showArchived ? "No projects at all yet" : "No projects yet"}
          description={
            isAdmin
              ? "Create the first project to start planning work. You can add tasks and invite teammates right after."
              : "An admin of this workspace hasn't created any projects yet."
          }
          actions={newProject}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>
      )}

      {active && <CreateProjectDialog organizationId={active.id} open={creating} onOpenChange={setCreating} />}
    </div>
  );
}
