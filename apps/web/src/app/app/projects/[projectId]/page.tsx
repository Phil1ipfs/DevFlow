import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectView } from "@/components/projects/project-view";

export const metadata: Metadata = { title: "Project" };

export default function ProjectPage({ params }: PageProps<"/app/projects/[projectId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      {params.then(({ projectId }) => (
        <ProjectView projectId={projectId} />
      ))}
    </Suspense>
  );
}
