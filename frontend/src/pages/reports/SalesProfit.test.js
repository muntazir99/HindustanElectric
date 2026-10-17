import { describe, expect, it } from "vitest";
import { periods } from "./SalesProfit.js";

describe("quick periods", () => {
  it("today, this month so far, and the whole of last month", () => {
    expect(periods("2026-10-17")).toEqual([
      ["Today", "2026-10-17", "2026-10-17"],
      ["This month", "2026-10-01", "2026-10-17"],
      ["Last month", "2026-09-01", "2026-09-30"],
    ]);
  });

  it("last month in January is December of the year before", () => {
    expect(periods("2027-01-05")[2]).toEqual(["Last month", "2026-12-01", "2026-12-31"]);
  });
});
