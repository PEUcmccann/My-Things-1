import { describe, expect, it } from "vitest";
import { exportDateText, exportFileName, restoreProblemText } from "./dataFiles";

describe("the JSON export's file", () => {
  it("is named after today's date", () => {
    expect(exportFileName("2026-11-27")).toBe("mythings-2026-11-27.json");
  });

  it("shows its export date in words, in local time", () => {
    expect(exportDateText(new Date(2026, 10, 27, 23, 30).toISOString())).toBe("27 November 2026");
  });

  it("explains each refusal", () => {
    expect(restoreProblemText("notJson")).toBe("This isn't a MyThings export");
    expect(restoreProblemText("notAnExport")).toBe("This isn't a MyThings export");
    expect(restoreProblemText("newerVersion")).toBe(
      "This export is from a newer version of MyThings",
    );
  });
});
