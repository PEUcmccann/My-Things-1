import type { IconName } from "./components/Icon";
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

/** Each list's icon is named after the list (see components/Icon.tsx). */
export const listIcons = {
  inbox: "inbox",
  today: "today",
  upcoming: "upcoming",
  anytime: "anytime",
  someday: "someday",
  logbook: "logbook",
  trash: "trash",
} as const satisfies Record<BuiltInList, IconName>;
