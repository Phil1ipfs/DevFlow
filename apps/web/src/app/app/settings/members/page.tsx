import type { Metadata } from "next";
import { MembersPanel } from "@/components/settings/members-panel";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage() {
  return <MembersPanel />;
}
