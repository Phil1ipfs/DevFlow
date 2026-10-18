import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductPreview } from "./product-preview";

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden">
      {/* Decorative background: faint grid fading out, plus a soft brand glow. */}
      <div
        aria-hidden
        className="bg-grid absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,var(--brand-soft),transparent)]"
      />

      <div className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <Link
            href="/status"
            className="group inline-flex animate-in items-center gap-2 rounded-full border bg-background/70 py-1 pr-2.5 pl-1.5 text-xs text-muted-foreground backdrop-blur fade-in fill-mode-both duration-700 hover:text-foreground"
          >
            <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-primary">Early access</span>
            <span className="hidden sm:inline">Built in the open, check live system status</span>
            <span className="sm:hidden">Live system status</span>
            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>

          <h1
            id="hero-heading"
            className="mt-6 animate-in text-4xl font-semibold tracking-tight text-balance fade-in slide-in-from-bottom-3 fill-mode-both delay-100 duration-700 sm:text-5xl lg:text-6xl"
          >
            Plan the work. Ship the work. <span className="text-primary">Support the people.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl animate-in text-base text-pretty text-muted-foreground fade-in slide-in-from-bottom-3 fill-mode-both delay-200 duration-700 sm:text-lg">
            DevFlow brings projects, Kanban boards and IT helpdesk tickets into one workspace, so engineering and
            operations teams stop losing context between tools.
          </p>

          <div className="mt-8 flex animate-in flex-col items-center justify-center gap-3 fade-in slide-in-from-bottom-3 fill-mode-both delay-300 duration-700 sm:flex-row">
            <Button asChild size="lg" className="h-10 w-full px-4 sm:w-auto">
              <Link href="/register">
                Create your workspace
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-10 w-full px-4 sm:w-auto">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="mt-14 animate-in fade-in slide-in-from-bottom-6 fill-mode-both delay-500 duration-1000 sm:mt-16">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}
