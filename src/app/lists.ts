import type { BuiltInList } from "./navigation";

export const listTitles: Record<BuiltInList, string> = {
  inbox: "Inbox",
  today: "Today",
  upcoming: "Upcoming",
  anytime: "Anytime",
  someday: "Someday",
  logbook: "Logbook",
  trash: "Trash",
};

export const listIcons: Record<BuiltInList, string> = {
  inbox: "📥",
  today: "☀️",
  upcoming: "📅",
  anytime: "🗂",
  someday: "📦",
  logbook: "📗",
  trash: "🗑",
};
