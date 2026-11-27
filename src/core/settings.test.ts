import { describe, expect, it } from "vitest";
import { createMyThings, fixedClock, memoryStore, type AccentColour } from "./index";
import { NOW, setup } from "./testSetup";

describe("accent colour", () => {
  it("is teal by default", () => {
    const { app } = setup();
    expect(app.accentColour()).toBe("teal");
  });

  it("can be changed and is kept after a reload", () => {
    const store = memoryStore();
    const clock = fixedClock(NOW);
    createMyThings({ clock, store }).setAccentColour("rose");
    expect(createMyThings({ clock, store: memoryStore(store.snapshot()) }).accentColour()).toBe(
      "rose",
    );
  });

  it("rejects colours that are not offered", () => {
    const { app } = setup();
    expect(() => app.setAccentColour("purple" as AccentColour)).toThrow();
    expect(app.accentColour()).toBe("teal");
  });
});
