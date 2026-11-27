import { describe, expect, it } from "vitest";
import { followEdit, tokenHint } from "./quickEntry";

describe("what a quick entry highlight says it sets", () => {
  const today = "2026-11-26";
  const when = (w: Parameters<typeof tokenHint>[0] & { kind: "when" }) => tokenHint(w, today);

  it("names the day a date phrase sets, with the When icon", () => {
    expect(when({ kind: "when", when: { kind: "date", date: "2026-11-27" } })).toEqual({
      text: "Tomorrow",
      icon: "when",
    });
    expect(when({ kind: "when", when: { kind: "date", date: "2026-12-12" } })).toEqual({
      text: "Sat 12 Dec",
      icon: "when",
    });
    expect(when({ kind: "when", when: { kind: "date", date: "2027-01-03" } })).toEqual({
      text: "Sun 3 Jan 2027",
      icon: "when",
    });
  });

  it("shows today, This Evening and Someday with their list icons", () => {
    expect(when({ kind: "when", when: { kind: "date", date: today } })).toEqual({
      text: "Today",
      icon: "today",
    });
    expect(when({ kind: "when", when: { kind: "thisEvening" } })).toEqual({
      text: "This Evening",
      icon: "evening",
    });
    expect(when({ kind: "when", when: { kind: "someday" } })).toEqual({
      text: "Someday",
      icon: "someday",
    });
  });

  it("adds nothing for other shorthand, which shows as typed", () => {
    expect(tokenHint({ kind: "priority", priority: "high" }, today)).toBeNull();
    expect(tokenHint({ kind: "tag", path: ["errand"] }, today)).toBeNull();
  });
});

describe("following an edit to quick entry text", () => {
  const before = "Buy milk #errand !high";
  const errand = 9;
  const high = 17;

  it("keeps offsets before the edit", () => {
    expect(followEdit([errand, high], before, "Buy milk #errand !high now")).toEqual([
      errand,
      high,
    ]);
  });

  it("moves offsets after the edit by the length of the change", () => {
    expect(followEdit([errand, high], before, "Buy fresh milk #errand !high")).toEqual([15, 23]);
    expect(followEdit([errand], before, "Buy #errand !high")).toEqual([4]);
  });

  it("moves an offset when text is typed right before its token", () => {
    expect(followEdit([errand], before, "Buy milk x #errand !high")).toEqual([11]);
  });

  it("drops an offset whose start was edited away", () => {
    expect(followEdit([errand, high], before, "Buy milk errand !high")).toEqual([16]);
  });

  it("keeps offsets when the text does not change", () => {
    expect(followEdit([errand], before, before)).toEqual([errand]);
  });
});
