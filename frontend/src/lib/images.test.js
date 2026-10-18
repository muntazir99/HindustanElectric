import { describe, expect, it } from "vitest";
import { fit } from "./images.js";

describe("shrinking website pictures", () => {
  it("fits the longer side into the limit, keeping the shape", () => {
    expect(fit(4000, 3000, 1200)).toEqual([1200, 900]);
    expect(fit(1080, 1920, 1200)).toEqual([675, 1200]);
  });

  it("never enlarges a small picture", () => {
    expect(fit(640, 480, 1200)).toEqual([640, 480]);
  });
});
