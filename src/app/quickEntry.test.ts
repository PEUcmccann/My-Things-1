import { describe, expect, it } from "vitest";
import { followEdit } from "./quickEntry";

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
