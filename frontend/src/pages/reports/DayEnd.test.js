import { describe, expect, it } from "vitest";
import { difference } from "./DayEnd.js";

describe("cash counted against cash in drawer", () => {
  it("says whether the drawer matches, is short or has extra", () => {
    expect(difference("340.00", "340")).toMatchObject({ text: "Matches the cash in drawer" });
    expect(difference("340.00", "300").text).toBe("Short by ₹40.00");
    expect(difference("340.00", "345.5").text).toBe("Extra ₹5.50");
    expect(difference("340.00", "")).toBeNull();
  });
});
