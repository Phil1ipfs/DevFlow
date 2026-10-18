import type { Metadata } from "next";
import { StatusBoard } from "@/components/status/status-board";

export const metadata: Metadata = {
  title: "System status",
};

export default function StatusPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <StatusBoard />
    </div>
  );
}
