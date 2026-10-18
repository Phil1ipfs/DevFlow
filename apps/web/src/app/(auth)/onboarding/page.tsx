import type { Metadata } from "next";
import { OnboardingView } from "@/components/workspace/onboarding-view";

export const metadata: Metadata = { title: "Create your workspace" };

export default function OnboardingPage() {
  return <OnboardingView />;
}
