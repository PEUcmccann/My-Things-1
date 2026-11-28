import { describe, expect, it } from "vitest";
import { didNotGetThrough, settled } from "./requests";

describe("telling a request that didn't get through", () => {
  it("knows how browsers and React Native word a failed fetch", () => {
    expect(didNotGetThrough("Failed to fetch")).toBe(true);
    expect(didNotGetThrough("TypeError: Network request failed")).toBe(true);
    expect(didNotGetThrough("Load failed")).toBe(true);
  });

  it("leaves a refusal from the server alone", () => {
    expect(didNotGetThrough("new row violates row-level security policy")).toBe(false);
  });
});

describe("a settled request", () => {
  it("passes on what supabase-js returns", async () => {
    const answer = { data: [1], error: null };
    expect(await settled(Promise.resolve(answer))).toBe(answer);
  });

  it("returns a thrown error, with no data, as supabase-js returns its own", async () => {
    const thrown = new TypeError("Failed to fetch");
    expect(await settled(Promise.reject(thrown))).toEqual({ data: null, error: thrown });
  });
});
