// Display helpers. The API sends decimals as strings so no money is lost to
// floating point; these only format for display.

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return rupees.format(Number(value));
}

/** "90.000" -> "90", "12.500" -> "12.5" */
export function plain(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(Number(value));
}

export function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function signed(value) {
  const number = Number(value);
  return number > 0 ? `+${plain(value)}` : plain(value);
}

export function date(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now - offset).toISOString().slice(0, 10);
}

/** Round half up to 2 decimals, for on-screen totals before the server confirms them. */
export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export const BASE_UNITS = [
  ["pc", "Piece"],
  ["m", "Metre"],
  ["ft", "Foot"],
  ["kg", "Kilogram"],
  ["l", "Litre"],
  ["set", "Set"],
  ["pair", "Pair"],
  ["pkt", "Packet"],
  ["roll", "Roll"],
];

export const GST_RATES = ["0", "5", "12", "18", "28", "40"];
