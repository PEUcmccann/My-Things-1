import { describe, expect, it } from "vitest";
import { repeatText } from "./format";

// 26 November 2026 is a Thursday.
const start = "2026-11-26";

describe("the wording of a Repeat rule", () => {
  it.each([
    [{ freq: "daily", interval: 1 }, "Every day"],
    [{ freq: "daily", interval: 3 }, "Every 3 days"],
    [{ freq: "weekly", interval: 1, byDay: ["MO", "TH"] }, "Every week on Mon, Thu"],
    [{ freq: "weekly", interval: 2 }, "Every 2 weeks on Thu"],
    [{ freq: "monthly", interval: 1, byMonthDay: [1] }, "Every month on the 1st"],
    [{ freq: "monthly", interval: 2, byMonthDay: [22, 3] }, "Every 2 months on the 3rd, 22nd"],
    [{ freq: "monthly", interval: 1, byMonthDay: [-1] }, "Every month on the last day"],
    [{ freq: "monthly", interval: 1 }, "Every month on the 26th"],
    [{ freq: "yearly", interval: 1 }, "Every year on 26 Nov"],
    [{ freq: "yearly", interval: 5 }, "Every 5 years on 26 Nov"],
  ] as const)("%o reads %s", (pattern, text) => {
    expect(repeatText(pattern as never, start)).toBe(text);
  });

  it.each([
    [{ freq: "daily", interval: 3 }, "Every 3 days after completion"],
    [{ freq: "weekly", interval: 1 }, "Every week after completion"],
    [{ freq: "monthly", interval: 2 }, "Every 2 months after completion"],
    [{ freq: "yearly", interval: 1 }, "Every year after completion"],
  ] as const)("after completion, %o reads %s", (pattern, text) => {
    expect(repeatText(pattern, start, "afterCompletion")).toBe(text);
  });

  const workdays = ["MO", "TU", "WE", "TH", "FR"];
  it.each([
    [
      { freq: "monthly", interval: 1, byDay: workdays, bySetPos: [-1] },
      "Every month on the last weekday",
    ],
    [
      { freq: "monthly", interval: 1, byDay: workdays, bySetPos: [1] },
      "Every month on the first weekday",
    ],
    [
      { freq: "monthly", interval: 1, byDay: ["SA", "SU"], bySetPos: [2] },
      "Every month on the second weekend day",
    ],
    [{ freq: "monthly", interval: 1, byDay: ["2TU"] }, "Every month on the second Tuesday"],
    [{ freq: "monthly", interval: 3, byDay: ["-1FR"] }, "Every 3 months on the last Friday"],
    [
      { freq: "monthly", interval: 1, byDay: ["1MO", "3MO"] },
      "Every month on the first and third Monday",
    ],
    [
      { freq: "monthly", interval: 1, byDay: ["1MO", "-1FR"] },
      "Every month on the first Monday and last Friday",
    ],
    [{ freq: "monthly", interval: 1, byDay: ["TU"] }, "Every month on every Tuesday"],
    [{ freq: "monthly", interval: 1, byDay: ["-2SU"] }, "Every month on the second-last Sunday"],
    [
      { freq: "yearly", interval: 1, byMonth: [3], byDay: ["1MO"] },
      "Every year on the first Monday of March",
    ],
    [
      { freq: "yearly", interval: 1, byMonth: [2], byMonthDay: [-1] },
      "Every year on the last day of February",
    ],
    [{ freq: "yearly", interval: 2, byMonth: [3], byMonthDay: [15] }, "Every 2 years on 15 Mar"],
    [{ freq: "yearly", interval: 1, byMonth: [6] }, "Every year on 26 Jun"],
    [{ freq: "yearly", interval: 1, byMonth: [6, 12] }, "Every year on 26 Jun, 26 Dec"],
    [{ freq: "daily", interval: 1, count: 5 }, "Every day, 5 times"],
    [{ freq: "daily", interval: 1, count: 1 }, "Every day, once"],
    [{ freq: "weekly", interval: 1, until: "2027-01-31" }, "Every week on Thu, until 31 Jan 2027"],
  ] as const)("%o reads %s", (pattern, text) => {
    expect(repeatText(pattern as never, start)).toBe(text);
  });

  it("ends a rule after completion the same way", () => {
    expect(repeatText({ freq: "daily", interval: 3, count: 4 }, start, "afterCompletion")).toBe(
      "Every 3 days after completion, 4 times",
    );
  });

  it("writes 11th to 13th with th", () => {
    expect(repeatText({ freq: "monthly", interval: 1, byMonthDay: [11, 12, 13, 21] }, start)).toBe(
      "Every month on the 11th, 12th, 13th, 21st",
    );
  });
});
