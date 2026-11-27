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

  it("writes 11th to 13th with th", () => {
    expect(repeatText({ freq: "monthly", interval: 1, byMonthDay: [11, 12, 13, 21] }, start)).toBe(
      "Every month on the 11th, 12th, 13th, 21st",
    );
  });
});
