// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readBarcodes, writeBarcode } from "zxing-wasm/full";
import { SHEETS, labelCount, labelFor, layout, runs } from "./labels.js";

describe("barcode bars", () => {
  it("bars drawn from the runs read back as the same code", async () => {
    const { symbol } = await writeBarcode("10023", { format: "Code128" });
    const bars = runs(symbol.data.subarray(0, symbol.width));
    // Draw the bars as a printer would (3 px per module, quiet zone each side) and read them like a scanner.
    const quiet = 10, scale = 3, width = (symbol.width + 2 * quiet) * scale, height = 40;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    for (const [x, w] of bars) {
      for (let px = (x + quiet) * scale; px < (x + quiet + w) * scale; px++) {
        for (let y = 0; y < height; y++) data.fill(0, (y * width + px) * 4, (y * width + px) * 4 + 3);
      }
    }
    const [read] = await readBarcodes({ data, width, height, colorSpace: "srgb" }, { formats: ["Code128"] });
    expect(read.text).toBe("10023");
  });

  it("joins neighbouring dark modules into one bar", () => {
    expect(runs([0, 0, 255, 0, 255, 255, 0, 0, 0])).toEqual([[0, 2], [3, 1], [6, 3]]);
  });
});

describe("sheet layout", () => {
  it("fills across then down, from the chosen sticker, onto a second sheet when full", () => {
    const sheet = SHEETS[65];
    const pages = layout(sheet, ["a", "b", "c"], 64);
    expect(pages.map((page) => page.map(({ label }) => label))).toEqual([["a", "b"], ["c"]]);
    // Sticker 64 is row 13, column 4.
    expect(pages[0][0].x).toBeCloseTo(4.7 + 3 * 40.6);
    expect(pages[0][0].y).toBeCloseTo(10.7 + 12 * 21.2);
    expect(pages[1][0]).toMatchObject({ x: 4.7, y: 10.7 });
  });

  it("every size fits on A4 (210 × 297 mm)", () => {
    for (const sheet of Object.values(SHEETS)) {
      expect(sheet.left + (sheet.cols - 1) * sheet.across + sheet.width).toBeLessThanOrEqual(210);
      expect(sheet.top + (sheet.rows - 1) * sheet.down + sheet.height).toBeLessThanOrEqual(297);
    }
  });

  it("nudge moves every label", () => {
    expect(layout(SHEETS[24], ["a"], 1, { x: 1, y: -0.5 })[0][0]).toMatchObject({ x: 8.2, y: 12.4 });
  });
});

describe("what a label says", () => {
  const item = {
    code: "10023",
    name: "Havells Lifeline wire 1.5 sq mm Red",
    base_unit: "m",
    selling_price: "28.00",
    rack: "A2",
    units: [
      { id: 1, name: "m", factor: "1", is_base: true, barcode: null },
      { id: 2, name: "coil", factor: "90", is_base: false, barcode: "8901030000011", selling_price: "2400.00" },
      { id: 3, name: "box", factor: "100", is_base: false, barcode: null, selling_price: null },
    ],
  };

  it("loose: the item code and price per base unit", () => {
    expect(labelFor(item, item.units[0])).toEqual({ code: "10023", name: item.name, price: "28.00", per: "m", rack: "A2" });
  });

  it("a pack with its own barcode gets the pack's barcode and price", () => {
    expect(labelFor(item, item.units[1])).toMatchObject({ code: "8901030000011", price: "2400.00", per: "coil" });
  });

  it("a pack without a barcode gets the loose label", () => {
    expect(labelFor(item, item.units[2])).toMatchObject({ code: "10023", per: "m" });
  });
});

describe("labels for a received bill", () => {
  it("one per piece or pack, one for loose wire", () => {
    expect(labelCount("12.000", { is_base: true }, "pc")).toBe(12);
    expect(labelCount("3.000", { is_base: false }, "m")).toBe(3); // 3 coils
    expect(labelCount("180.000", { is_base: true }, "m")).toBe(1); // 180 m loose
    expect(labelCount("2.5", { is_base: true }, "set")).toBe(3);
  });
});
