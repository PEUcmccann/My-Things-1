import { formatEstimate, type DateRange, type EstimateChoice } from "../core";

/** What the Smart List editor calls each relative date range. */
export const dateRangeNames: Record<DateRange, string> = {
  todayOrEarlier: "Today or earlier",
  today: "Today",
  tomorrow: "Tomorrow",
  thisWeek: "This week",
  next7Days: "Next 7 days",
  thisMonth: "This month",
  hasDate: "Has a date",
  noDate: "No date",
};

/** "Up to 15m", "More than 1h" or "Not set". */
export function estimateChoiceName(choice: EstimateChoice): string {
  switch (choice.kind) {
    case "notSet":
      return "Not set";
    case "upTo":
      return `Up to ${formatEstimate(choice.minutes)}`;
    case "moreThan":
      return `More than ${formatEstimate(choice.minutes)}`;
  }
}

/** A stable key for an Estimate choice, as used in test IDs: "upTo-15", "notSet". */
export function estimateChoiceKey(choice: EstimateChoice): string {
  return choice.kind === "notSet" ? "notSet" : `${choice.kind}-${choice.minutes}`;
}

/** The Estimate choices the editor offers, before any saved custom ones. */
export const estimateChoices: EstimateChoice[] = [
  { kind: "upTo", minutes: 5 },
  { kind: "upTo", minutes: 15 },
  { kind: "upTo", minutes: 30 },
  { kind: "upTo", minutes: 60 },
  { kind: "moreThan", minutes: 15 },
  { kind: "moreThan", minutes: 30 },
  { kind: "moreThan", minutes: 60 },
  { kind: "notSet" },
];
