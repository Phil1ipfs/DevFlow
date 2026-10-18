"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/api/projects";
import { EditProjectDialog } from "./project-dialogs";

export function ProjectHeader({ project, canManage }: { project: Project; canManage: boolean }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-3">
      <Link href="/app/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" aria-hidden />
        Projects
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft font-mono text-sm font-semibold text-primary">
            {project.key.slice(0, 3)}
          </span>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              {project.name}
              {project.archivedAt && (
                <Badge variant="outline" className="text-muted-foreground">
                  Archived
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{project.key}</span>
              {project.lead && <> · Lead: {project.lead.displayName}</>}
            </p>
          </div>
        </div>
        {canManage && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Settings2 data-icon="inline-start" />
            Project settings
          </Button>
        )}
      </div>
      {project.description && <p className="max-w-3xl text-sm text-muted-foreground">{project.description}</p>}
      {canManage && <EditProjectDialog project={project} open={editing} onOpenChange={setEditing} />}
    </div>
  );
}
