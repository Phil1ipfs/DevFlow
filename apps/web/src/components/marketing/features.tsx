import type { ReactNode } from "react";
import { AtSign, FolderKanban, History, LifeBuoy, MessagesSquare, SquareKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

function FeatureCard({
  icon: Icon,
  title,
  description,
  visual,
  className,
}: {
  icon: typeof FolderKanban;
  title: string;
  description: string;
  visual?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-6 transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
        className,
      )}
    >
      <span className="grid size-9 place-items-center rounded-lg border bg-background text-primary transition-colors group-hover:bg-brand-soft">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {visual && (
        <div aria-hidden className="mt-6 flex-1">
          {visual}
        </div>
      )}
    </article>
  );
}

function KanbanVisual() {
  const columns = [
    { title: "To do", cards: [72, 54] },
    { title: "In progress", cards: [64, 80, 48], highlight: 1 },
    { title: "Done", cards: [58] },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/40 p-2.5">
      {columns.map((column) => (
        <div key={column.title} className="space-y-1.5">
          <p className="px-0.5 text-[10px] font-medium text-muted-foreground">{column.title}</p>
          {column.cards.map((width, index) => (
            <div
              key={index}
              className={cn(
                "space-y-1.5 rounded-md border bg-card p-2 transition-transform duration-300",
                column.highlight === index &&
                  "border-primary/40 shadow-md group-hover:-translate-y-0.5 group-hover:rotate-[-1.5deg]",
              )}
            >
              <div className="h-1.5 rounded-full bg-foreground/15" style={{ width: `${width}%` }} />
              <div className="h-1.5 w-2/5 rounded-full bg-foreground/8" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function HelpdeskVisual() {
  const tickets = [
    { subject: "VPN drops every few minutes", status: "New", tone: "bg-chart-1" },
    { subject: "Laptop request for new hire", status: "In progress", tone: "bg-chart-3" },
    { subject: "Reset SSO for contractor account", status: "Resolved", tone: "bg-chart-2" },
  ];
  return (
    <ul className="divide-y rounded-xl border bg-muted/40">
      {tickets.map((ticket) => (
        <li key={ticket.subject} className="flex items-center gap-3 px-3 py-2.5 text-xs">
          <span className={cn("size-1.5 shrink-0 rounded-full", ticket.tone)} />
          <span className="truncate">{ticket.subject}</span>
          <span className="ml-auto shrink-0 rounded-full border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
            {ticket.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ProjectsVisual() {
  const projects = [
    { name: "Web platform", tone: "bg-chart-1", members: ["MR", "TK"] },
    { name: "Mobile app", tone: "bg-chart-4", members: ["AL"] },
    { name: "IT operations", tone: "bg-chart-2", members: ["JS", "AL"] },
  ];
  return (
    <ul className="space-y-1.5">
      {projects.map((project) => (
        <li key={project.name} className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <span className={cn("size-2 rounded-sm", project.tone)} />
          <span className="font-medium">{project.name}</span>
          <span className="ml-auto flex -space-x-1.5">
            {project.members.map((member) => (
              <span
                key={member}
                className="grid size-5 place-items-center rounded-full border-2 border-card bg-secondary text-[8px] font-semibold"
              >
                {member}
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Features() {
  return (
    <section id="features" aria-labelledby="features-heading" className="scroll-mt-20 border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <SectionHeading
          id="features-heading"
          eyebrow="Features"
          title="Everything your team tracks, in one place"
          description="Planning, delivery and support usually live in three different tools. DevFlow keeps them side by side, with the same people, permissions and history."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <FeatureCard
            className="md:col-span-2"
            icon={SquareKanban}
            title="Kanban boards"
            description="Drag tasks across statuses, set priorities and assignees, and filter the board down to exactly what matters this week."
            visual={<KanbanVisual />}
          />
          <FeatureCard
            icon={FolderKanban}
            title="Projects"
            description="Group work into projects with owners, members and a clear scope. Every project belongs to your organization's workspace."
            visual={<ProjectsVisual />}
          />
          <FeatureCard
            icon={MessagesSquare}
            title="Collaboration"
            description="Comment on tasks, mention teammates and follow a complete activity history, with real-time notifications as work moves."
            visual={
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
                  <AtSign className="size-3" /> Mentions
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
                  <History className="size-3" /> Activity
                </span>
              </div>
            }
          />
          <FeatureCard
            className="md:col-span-2"
            icon={LifeBuoy}
            title="Helpdesk ticketing"
            description="Take IT requests from the whole company in a dedicated queue, triage by priority and resolve them alongside engineering work."
            visual={<HelpdeskVisual />}
          />
        </div>
      </div>
    </section>
  );
}
