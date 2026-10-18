import { Building2, LifeBuoy, SquareKanban } from "lucide-react";
import { SectionHeading } from "./section-heading";

const STEPS = [
  {
    icon: Building2,
    title: "Create your workspace",
    description:
      "Set up your organization, invite teammates and assign roles that decide who can see and change what.",
  },
  {
    icon: SquareKanban,
    title: "Plan and track the work",
    description:
      "Create projects, break them into tasks and move each one across the board as it progresses, from backlog to done.",
  },
  {
    icon: LifeBuoy,
    title: "Support the whole company",
    description:
      "Route IT requests into the helpdesk queue, so support and engineering share one source of truth instead of two.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 border-t bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <SectionHeading
          id="how-heading"
          eyebrow="How it works"
          title="From first project to resolved ticket"
          description="DevFlow follows the way teams already work. Three steps, one workspace."
        />

        <div className="relative mt-14">
          {/* Connector line behind the step markers on wide screens. */}
          <div aria-hidden className="absolute top-5 right-[16%] left-[16%] hidden h-px bg-border md:block" />
          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map(({ icon: Icon, title, description }, index) => (
              <li key={title} className="relative flex gap-4 md:flex-col md:items-center md:text-center">
                <span className="relative grid size-10 shrink-0 place-items-center rounded-full border bg-background text-primary shadow-xs">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <div>
                  <p className="font-mono text-xs text-muted-foreground">Step {index + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:mx-auto md:max-w-xs">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
