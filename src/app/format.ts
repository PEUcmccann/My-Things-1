import { addDays, daysBetween, type LocalDate, type ToDo } from "../core";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dateParts(date: LocalDate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

/** "Fri 27 Nov", or "Today"/"Tomorrow"/"Yesterday" when close. */
export function formatDate(date: LocalDate, today: LocalDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const { y, m, d } = dateParts(date);
  const weekday = days[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const year = dateParts(today).y === y ? "" : ` ${y}`;
  return `${weekday} ${d} ${months[m - 1]}${year}`;
}

export function monthName(m: number): string {
  return months[m - 1];
}

export function formatMonth(date: LocalDate): string {
  const { y, m } = dateParts(date);
  return `${monthName(m)} ${y}`;
}

/** "27 Nov – 3 Dec" */
export function formatRange(start: LocalDate, days: number): string {
  const a = dateParts(start);
  const b = dateParts(addDays(start, days - 1));
  return `${a.d} ${monthName(a.m)} – ${b.d} ${monthName(b.m)}`;
}

/** What "When" shows for a To-do or Project. */
export function whenText(
  toDo: Pick<ToDo, "someday" | "startDate"> & { evening?: boolean },
  today: string,
): string {
  if (toDo.someday) return "📦 Someday";
  if (!toDo.startDate) return "No Start date";
  if (toDo.startDate <= today) return toDo.evening ? "🌙 This Evening" : "☀️ Today";
  return formatDate(toDo.startDate, today);
}
