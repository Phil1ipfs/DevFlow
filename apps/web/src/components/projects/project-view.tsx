"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@/lib/query";
import { FolderX } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/components/workspace/organization-provider";
import { isApiError } from "@/lib/api/client";
import { hasRole } from "@/lib/api/organizations";
import { projectQuery } from "@/lib/api/projects";
import { ProjectHeader } from "./project-header";
import { ProjectWork } from "./project-work";

export function ProjectView({ projectId }: { projectId: string }) {
  const { organizations, active, setActive } = useOrganization();
  const { data: project, isPending, error } = useQuery(projectQuery(projectId));

  // Opening a link to a project in another of the user's workspaces switches to that workspace.
  useEffect(() => {
    if (project && active && project.organizationId !== active.id) setActive(project.organizationId);
  }, [project, active, setActive]);

  if (isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading project">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={FolderX}
        title={isApiError(error, 404) ? "Project not found" : "Couldn't load this project"}
        description={
          isApiError(error, 404)
            ? "It may have been deleted, or it belongs to a workspace you're not a member of."
            : error.message
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/app/projects">All projects</Link>
          </Button>
        }
      />
    );
  }

  const role = organizations?.find((o) => o.id === project.organizationId)?.role;

  return (
    <div className="space-y-8">
      <ProjectHeader project={project} canManage={hasRole(role, "Admin")} />
      <ProjectWork project={project} />
    </div>
  );
}
