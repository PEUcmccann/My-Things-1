import { describe, expect, it } from "vitest";
import { keyboardInset } from "./keyboard";

// iPhone 13 in a Home Screen web app: the layout viewport is 844 points tall.
describe("keyboardInset", () => {
  it("is zero when the whole page is visible", () => {
    expect(keyboardInset({ layoutHeight: 844, height: 844, offsetTop: 0, scale: 1 })).toBe(0);
  });

  it("is the height the keyboard covers at the bottom", () => {
    expect(keyboardInset({ layoutHeight: 844, height: 508, offsetTop: 0, scale: 1 })).toBe(336);
  });

  it("allows for Safari panning the visible area down the page", () => {
    expect(keyboardInset({ layoutHeight: 844, height: 508, offsetTop: 100, scale: 1 })).toBe(236);
  });

  it("is zero while the page is pinch-zoomed, since then the keyboard is not the cause", () => {
    expect(keyboardInset({ layoutHeight: 844, height: 422, offsetTop: 0, scale: 2 })).toBe(0);
  });

  it("is never negative", () => {
    expect(keyboardInset({ layoutHeight: 844, height: 844, offsetTop: 20, scale: 1 })).toBe(0);
  });
});
