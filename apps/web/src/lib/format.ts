const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 hours ago", "yesterday", "just now". Only call in the browser (it depends on the clock). */
export function timeAgo(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Due dates are calendar dates ("2026-10-20"), not instants, so format them without time zones. */
export function formatDueDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year, month - 1, day);
  const sameYear = value.getFullYear() === new Date().getFullYear();
  return value.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function dueState(date: string | null, done: boolean): "overdue" | "soon" | "normal" | null {
  if (!date || done) return date ? "normal" : null;
  const [year, month, day] = date.split("-").map(Number);
  const due = new Date(year, month - 1, day).getTime();
  const today = new Date(new Date().toDateString()).getTime();
  if (due < today) return "overdue";
  if (due - today <= 2 * 24 * 3600 * 1000) return "soon";
  return "normal";
}
