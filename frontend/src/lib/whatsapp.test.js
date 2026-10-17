import { describe, expect, it } from "vitest";
import { billMessage, orderMessage, receiptMessage, reminderMessage, whatsappLink } from "./whatsapp.js";

const shop = { name: "Hindustan Electric", phone: "9876543210", upi_id: "hindustan@upi" };
const text = (link) => decodeURIComponent(link.split("?text=")[1]);

describe("WhatsApp link", () => {
  it("a 10-digit number gets 91; 0 and +91 forms end up the same", () => {
    for (const phone of ["9876501234", "09876501234", "+91 98765 01234", "919876501234"]) {
      expect(whatsappLink(phone, "Hi").startsWith("https://wa.me/919876501234?text=")).toBe(true);
    }
  });

  it("no number, or one that isn't a mobile number: WhatsApp asks who to send it to", () => {
    expect(whatsappLink("", "Hi")).toBe("https://wa.me/?text=Hi");
    expect(whatsappLink("12345", "Hi")).toBe("https://wa.me/?text=Hi");
  });

  it("the message survives the link: new lines, ₹, emoji", () => {
    expect(text(whatsappLink("9876501234", "Namaste 🙏\n*₹2,757* & 50%"))).toBe("Namaste 🙏\n*₹2,757* & 50%");
  });
});

const line = (n, total = "118.00") => ({ description: `Switch ${n}`, quantity: "2.000", unit_name: "pc", total });
const bill = {
  kind: "invoice",
  number: "HE/26-27/00012",
  invoice_date: "2026-10-17",
  buyer_name: "Ramesh",
  customer_detail: { name: "Ramesh", balance: "1250.00" },
  lines: [line(1, "2520.00"), line(2)],
  total: "2638.00",
  credit_amount: "638.00",
  payments: [
    { kind: "sale", amount: "2000.00", mode_display: "Cash" },
    { kind: "refund", amount: "10.00", mode_display: "Cash" },
  ],
};

describe("messages", () => {
  it("bill: items, total, how paid, udhaar on this bill and in all", () => {
    expect(billMessage(bill, shop)).toBe(
      [
        "Namaste Ramesh ji 🙏",
        "Hindustan Electric — Bill HE/26-27/00012, 17 Oct 2026",
        "",
        "1. Switch 1 — 2 pc — ₹2,520",
        "2. Switch 2 — 2 pc — ₹118",
        "",
        "*Total: ₹2,638*",
        "Diya: ₹2,000 Cash",
        "Is bill ka udhaar: ₹638",
        "Kul baaki (aaj tak): ₹1,250",
        "",
        "Dhanyavaad, Hindustan Electric · 9876543210",
      ].join("\n"),
    );
  });

  it("bill: first 10 items, then how many more; a walk-in paid in full gets no udhaar lines", () => {
    const big = { ...bill, buyer_name: "", customer_detail: null, credit_amount: "0.00", lines: Array.from({ length: 13 }, (_, i) => line(i + 1)) };
    const message = billMessage(big, shop);
    expect(message.startsWith("Namaste 🙏\n")).toBe(true);
    expect(message).toContain("10. Switch 10");
    expect(message).not.toContain("11. Switch 11");
    expect(message).toContain("+3 aur items");
    expect(message).not.toContain("udhaar");
    expect(message).not.toContain("baaki");
  });

  it("estimate: total and valid until, nothing about payment", () => {
    const estimate = { ...bill, kind: "quotation", number: "QT/26-27/00003", valid_until: "2026-10-24", payments: [] };
    const message = billMessage(estimate, shop);
    expect(message).toContain("Hindustan Electric — Estimate QT/26-27/00003, 17 Oct 2026");
    expect(message).toContain("Ye rate 24 Oct 2026 tak hain.");
    expect(message).not.toContain("Diya");
    expect(message).not.toContain("udhaar");
  });

  it("receipt: amount, mode, number, and what is left", () => {
    const receipt = {
      customer_detail: { name: "Ramesh" },
      amount: "500.00",
      mode_display: "UPI",
      date: "2026-10-17",
      receipt_number: "RC/26-27/00004",
      balance_after: "750.00",
    };
    expect(receiptMessage(receipt, shop)).toBe(
      "Namaste Ramesh ji 🙏\nHindustan Electric: aapka *₹500* mila (UPI), 17 Oct 2026. Receipt RC/26-27/00004.\nAb baaki: ₹750\n\nDhanyavaad, Hindustan Electric · 9876543210",
    );
    expect(receiptMessage({ ...receipt, balance_after: "0.00" }, shop)).toContain("Ab koi baaki nahi.");
    expect(receiptMessage({ ...receipt, balance_after: "-200.00" }, shop)).toContain("Advance jama: ₹200");
  });

  it("reminder: amount due as of the day, UPI ID only if the shop has one", () => {
    const customer = { name: "Ramesh", balance: "2757.00" };
    expect(reminderMessage(customer, shop, "2026-10-02")).toBe(
      "Namaste Ramesh ji 🙏 Hindustan Electric mein aapka *₹2,757* baaki hai (02 Oct 2026 tak). Suvidha anusaar jama kar dein.\nUPI: hindustan@upi\n\nDhanyavaad, Hindustan Electric · 9876543210",
    );
    expect(reminderMessage(customer, { name: "Hindustan Electric", upi_id: "" }, "2026-10-02")).not.toContain("UPI");
  });

  it("order: every item and quantity, the note, no rates", () => {
    const order = {
      number: "PO/26-27/00001",
      order_date: "2026-10-17",
      note: "Send by Saturday",
      lines: Array.from({ length: 12 }, (_, i) => ({ item_name: `Wire ${i + 1}`, quantity: "2.000", unit_name: "coil", rate: "999" })),
    };
    const message = orderMessage(order, shop);
    expect(message.startsWith("Namaste 🙏\nHindustan Electric — Order PO/26-27/00001, 17 Oct 2026\n\n1. Wire 1 — 2 coil\n")).toBe(true);
    expect(message).toContain("12. Wire 12 — 2 coil");
    expect(message).toContain("\n\nSend by Saturday\n");
    expect(message).not.toContain("999");
  });
});
