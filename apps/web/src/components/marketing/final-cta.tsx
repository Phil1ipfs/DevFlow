import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-heading" className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="relative isolate overflow-hidden rounded-3xl border bg-card px-6 py-14 text-center sm:px-12">
          <div
            aria-hidden
            className="bg-grid absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_60%_80%_at_50%_100%,black,transparent)]"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-[radial-gradient(ellipse_50%_70%_at_50%_100%,var(--brand-soft),transparent)]"
          />
          <h2 id="cta-heading" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            See DevFlow in action
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
            Create a workspace, invite your team and put your first project on the board in a few minutes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-10 w-full px-4 sm:w-auto">
              <Link href="/register">
                Create your workspace
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-10 w-full px-4 sm:w-auto">
              <Link href="/status">
                <Activity data-icon="inline-start" />
                View system status
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
