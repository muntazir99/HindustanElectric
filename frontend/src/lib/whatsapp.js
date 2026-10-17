// WhatsApp messages (plan §12): a link opens WhatsApp with the message typed and addressed; staff press Send.
// Free: it goes from the shop's own WhatsApp. No automatic sending, no PDF.
import { bigMoney, date, plain } from "./format.js";

/** wa.me link. A 10-digit Indian number gets 91 in front; with no usable number WhatsApp asks who to send it to. */
export function whatsappLink(phone, text) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  const to = digits.length === 12 && digits.startsWith("91") ? digits : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

const hello = (name) => (name ? `Namaste ${name} ji 🙏` : "Namaste 🙏");
const thanks = (shop) => [`Dhanyavaad, ${shop.name}`, shop.phone].filter(Boolean).join(" · ");
const MAX_LINES = 10;
/** Lines of a message; false, null and undefined parts are left out, "" stays as a blank line. */
const join = (parts) => parts.filter((part) => part || part === "").join("\n");

/** A bill or an estimate: items (first 10), total; for a bill, how it was paid and udhaar. */
export function billMessage(bill, shop) {
  const estimate = bill.kind === "quotation";
  const lines = bill.lines.slice(0, MAX_LINES).map((line, i) => `${i + 1}. ${line.description} — ${plain(line.quantity)} ${line.unit_name} — ${bigMoney(line.total)}`);
  if (bill.lines.length > MAX_LINES) lines.push(`+${bill.lines.length - MAX_LINES} aur items`);
  const paid = bill.payments.filter((p) => p.kind === "sale").map((p) => `${bigMoney(p.amount)} ${p.mode_display}`);
  const owes = Number(bill.customer_detail?.balance || 0);
  return join([
    hello(bill.buyer_name || bill.customer_detail?.name),
    `${shop.name} — ${estimate ? "Estimate" : "Bill"} ${bill.number}, ${date(bill.invoice_date)}`,
    "",
    ...lines,
    "",
    `*Total: ${bigMoney(bill.total)}*`,
    ...(estimate
      ? [bill.valid_until && `Ye rate ${date(bill.valid_until)} tak hain.`]
      : [
          paid.length > 0 && `Diya: ${paid.join(", ")}`,
          Number(bill.credit_amount) > 0 && `Is bill ka udhaar: ${bigMoney(bill.credit_amount)}`,
          owes > 0 && `Kul baaki (aaj tak): ${bigMoney(owes)}`,
        ]),
    "",
    thanks(shop),
  ]);
}

/** Money received against khata, and what is still due. */
export function receiptMessage(receipt, shop) {
  const left = Number(receipt.balance_after || 0);
  return [
    hello(receipt.customer_detail?.name),
    `${shop.name}: aapka *${bigMoney(receipt.amount)}* mila (${receipt.mode_display}), ${date(receipt.date)}. Receipt ${receipt.receipt_number}.`,
    left > 0 ? `Ab baaki: ${bigMoney(left)}` : left < 0 ? `Advance jama: ${bigMoney(-left)}` : "Ab koi baaki nahi.",
    "",
    thanks(shop),
  ].join("\n");
}

/** A polite udhaar reminder, with the shop's UPI ID if set. */
export function reminderMessage(customer, shop, day) {
  return join([
    `${hello(customer.name)} ${shop.name} mein aapka *${bigMoney(customer.balance)}* baaki hai (${date(day)} tak). Suvidha anusaar jama kar dein.`,
    shop.upi_id ? `UPI: ${shop.upi_id}` : null,
    "",
    thanks(shop),
  ]);
}

/** An order for a distributor: every item and quantity, no rates. */
export function orderMessage(order, shop) {
  return join([
    "Namaste 🙏",
    `${shop.name} — Order ${order.number}, ${date(order.order_date)}`,
    "",
    ...order.lines.map((line, i) => `${i + 1}. ${line.item_name} — ${plain(line.quantity)} ${line.unit_name}`),
    ...(order.note ? ["", order.note] : []),
    "",
    "Kripya maal bhejne ki tareekh bata dein.",
    thanks(shop),
  ]);
}
