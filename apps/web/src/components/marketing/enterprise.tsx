import { Bell, Building2, Database, FileClock, KeyRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./section-heading";

const CAPABILITIES = [
  {
    icon: UsersRound,
    title: "Role-based access",
    description: "Owners, admins and members per organization, with permissions enforced by the API on every request.",
  },
  {
    icon: Building2,
    title: "Organization isolation",
    description: "Every record belongs to one organization, and queries are scoped so data never crosses workspaces.",
  },
  {
    icon: KeyRound,
    title: "Secure sessions",
    description: "HTTP-only, same-site cookies with CSRF protection. No access tokens sitting in browser storage.",
  },
  {
    icon: FileClock,
    title: "Audit logs",
    description: "A record of who changed what and when, ready for security reviews and compliance.",
  },
  {
    icon: Bell,
    title: "Real-time updates",
    description: "Boards, tickets and notifications update live over SignalR, without refreshing the page.",
  },
  {
    icon: Database,
    title: "Standard, portable stack",
    description: "ASP.NET Core, PostgreSQL and Next.js. Proven technology you can host in the cloud of your choice.",
  },
];

export function Enterprise() {
  return (
    <section id="enterprise" aria-labelledby="enterprise-heading" className="scroll-mt-20 border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <SectionHeading
          id="enterprise-heading"
          eyebrow="Enterprise ready"
          title="Built for how organizations actually work"
          description="Security and governance are part of DevFlow's foundation, not an upgrade tier."
        >
          <Badge variant="outline" className="text-muted-foreground">
            On the roadmap as DevFlow is built in the open
          </Badge>
        </SectionHeading>

        <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="group bg-card p-6 transition-colors hover:bg-muted/40">
              <Icon
                className="size-5 text-muted-foreground transition-colors group-hover:text-primary"
                aria-hidden
              />
              <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
