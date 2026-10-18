/**
 * SAMPLE DATA — illustrative only.
 *
 * Used by the landing page preview and the demo workspace to show what layouts look like
 * before the real features exist. Nothing here comes from the API or represents real
 * people, projects or metrics. Delete usages as each feature is built for real.
 */

export type SamplePriority = "urgent" | "high" | "medium" | "low";

export type SampleTask = {
  key: string;
  title: string;
  label: string;
  labelTone: "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5";
  priority: SamplePriority;
  assignee: string;
  comments?: number;
};

export type SampleColumn = {
  id: string;
  title: string;
  tone: "muted" | "chart-1" | "chart-3" | "chart-2";
  tasks: SampleTask[];
};

export const SAMPLE_BOARD: SampleColumn[] = [
  {
    id: "backlog",
    title: "Backlog",
    tone: "muted",
    tasks: [
      { key: "DF-128", title: "Export board as CSV", label: "Feature", labelTone: "chart-4", priority: "low", assignee: "JS" },
      { key: "DF-131", title: "Keyboard shortcuts for triage", label: "UX", labelTone: "chart-3", priority: "medium", assignee: "AL" },
    ],
  },
  {
    id: "todo",
    title: "To do",
    tone: "chart-3",
    tasks: [
      { key: "DF-119", title: "Invite members by email", label: "Feature", labelTone: "chart-4", priority: "high", assignee: "MR", comments: 3 },
      { key: "DF-124", title: "Add priority filter to board", label: "UX", labelTone: "chart-3", priority: "medium", assignee: "JS" },
    ],
  },
  {
    id: "in-progress",
    title: "In progress",
    tone: "chart-1",
    tasks: [
      { key: "DF-112", title: "Role-based access for projects", label: "Security", labelTone: "chart-5", priority: "urgent", assignee: "AL", comments: 6 },
      { key: "DF-115", title: "Activity feed on task details", label: "Feature", labelTone: "chart-4", priority: "medium", assignee: "TK", comments: 2 },
    ],
  },
  {
    id: "done",
    title: "Done",
    tone: "chart-2",
    tasks: [
      { key: "DF-104", title: "Health check endpoint", label: "Platform", labelTone: "chart-1", priority: "high", assignee: "MR" },
      { key: "DF-101", title: "PostgreSQL migrations", label: "Platform", labelTone: "chart-1", priority: "medium", assignee: "TK" },
    ],
  },
];
