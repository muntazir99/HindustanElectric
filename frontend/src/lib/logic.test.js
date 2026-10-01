import { describe, expect, it } from "vitest";
import { lineAmounts } from "../pages/purchases/PurchaseEntry.js";
import { variantsPayload } from "../pages/items/ItemNew.js";
import { errorMessage } from "./errors.js";
import { plain, plural, round2, signed } from "./format.js";

describe("purchase line amounts (must match the server)", () => {
  it("applies discount before GST", () => {
    expect(lineAmounts({ quantity: "2", rate: "1000", discount_percent: "10", gst_rate: "18" })).toEqual({ taxable: 1800, tax: 324 });
  });

  it("rounds to paise like the server", () => {
    // Same case as purchases/tests.py::test_amounts_round_to_paise
    expect(lineAmounts({ quantity: "3", rate: "10.3333", discount_percent: "0", gst_rate: "18" })).toEqual({ taxable: 31, tax: 5.58 });
  });

  it("treats blank fields as zero", () => {
    expect(lineAmounts({ quantity: "5", rate: "", discount_percent: "", gst_rate: "18" })).toEqual({ taxable: 0, tax: 0 });
  });
});

describe("variant rows to API payload", () => {
  const row = { key: 1, variant: " 1.5 sq mm Red ", selling_price: "28", mrp: "", barcode: "", pack_price: "2400", pack_mrp: "", pack_barcode: "111", rack: "W1", min_stock: "" };

  it("trims names, sends blank prices as null and leaves out blank text", () => {
    const [variant] = variantsPayload([row], true);
    expect(variant).toEqual({ variant: "1.5 sq mm Red", selling_price: "28", mrp: null, pack_price: "2400", pack_mrp: null, pack_barcode: "111", rack: "W1" });
  });

  it("drops pack columns when there is no pack", () => {
    const [variant] = variantsPayload([row], false);
    expect(variant).not.toHaveProperty("pack_price");
    expect(variant).not.toHaveProperty("pack_barcode");
  });
});

describe("format helpers", () => {
  it("formats numbers for people", () => {
    expect(plain("90.000")).toBe("90");
    expect(signed("-10.000")).toBe("-10");
    expect(signed("5")).toBe("+5");
    expect(plural(1, "item")).toBe("1 item");
    expect(plural(3, "item")).toBe("3 items");
    expect(round2(1.005)).toBe(1.01);
  });
});

describe("error messages", () => {
  it("explains a lost connection", () => {
    expect(errorMessage({})).toMatch(/Can't reach the server/);
  });

  it("joins field errors into one sentence", () => {
    const error = { response: { status: 400, data: { bill_number: ["Already entered."], lines: [{ unit: ["Wrong unit."] }] } } };
    expect(errorMessage(error)).toBe("Bill number: Already entered. Line 1 · unit: Wrong unit.");
  });

  it("uses the server's detail message", () => {
    expect(errorMessage({ response: { status: 400, data: { detail: "Nothing has been counted yet." } } })).toBe("Nothing has been counted yet.");
  });

  it("asks to wait after too many tries", () => {
    expect(errorMessage({ response: { status: 429, data: { detail: "Request was throttled." } } })).toMatch(/Wait a minute/);
  });

  it("never shows a server crash's page or details", () => {
    expect(errorMessage({ response: { status: 500, data: "<!doctype html><title>Server Error</title>" } })).toMatch(
      /^Something went wrong on the server/
    );
  });
});
