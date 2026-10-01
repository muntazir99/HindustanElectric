const FIELD_LABELS = {
  non_field_errors: "",
  detail: "",
  // Lists of rows: entries are labelled "Line 1", "Line 2"...
  lines: "",
  variants: "",
  bill_number: "Bill number",
  selling_price: "Selling price",
  mrp: "MRP",
  gst_rate: "GST",
  hsn_code: "HSN",
  gstin: "GSTIN",
};

function flatten(value, prefix = "") {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return [prefix ? `${prefix}: ${value}` : value];
  if (Array.isArray(value)) return value.flatMap((entry, index) =>
    typeof entry === "object" && entry !== null && !Array.isArray(entry)
      ? flatten(entry, prefix ? `${prefix} (line ${index + 1})` : `Line ${index + 1}`)
      : flatten(entry, prefix)
  );
  return Object.entries(value).flatMap(([key, inner]) => {
    if (key === "product_id") return [];
    const label = key in FIELD_LABELS ? FIELD_LABELS[key] : key.replace(/_/g, " ");
    return flatten(inner, [prefix, label].filter(Boolean).join(" · "));
  });
}

/** Turn an API error into a sentence for the screen. */
export function errorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error?.response) return "Can't reach the server. Check the internet connection.";
  if (error.response.status === 403) {
    return error.response.data?.detail || "You don't have permission to do this.";
  }
  const messages = flatten(error.response.data);
  return messages.length ? messages.join(" ") : fallback;
}
