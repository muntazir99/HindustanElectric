import { describe, expect, it } from "vitest";
import { gstPeriods } from "./GstSummary.js";

describe("GST periods", () => {
  it("12 months newest first, then the last 4 quarters", () => {
    const periods = gstPeriods("2026-10-17");
    expect(periods[0]).toEqual(["Oct 2026", "2026-10-01", "2026-10-31"]);
    expect(periods[1]).toEqual(["Sept 2026", "2026-09-01", "2026-09-30"]);
    expect(periods[11]).toEqual(["Nov 2025", "2025-11-01", "2025-11-30"]);
    expect(periods.slice(12).map(([, from, to]) => [from, to])).toEqual([
      ["2026-10-01", "2026-12-31"],
      ["2026-07-01", "2026-09-30"],
      ["2026-04-01", "2026-06-30"],
      ["2026-01-01", "2026-03-31"],
    ]);
  });

  it("February ends on the right day", () => {
    expect(gstPeriods("2028-03-02")[1]).toEqual(["Feb 2028", "2028-02-01", "2028-02-29"]);
  });
});
