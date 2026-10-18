import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

// Route group for sign-in pages: a focused, centered layout without the marketing chrome.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative isolate flex flex-1 flex-col">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,var(--brand-soft),transparent)]"
      />
      <header className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:pt-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <footer className="pb-6 text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          ← Back to website
        </Link>
      </footer>
    </div>
  );
}
