import api from "../api.js";

/** Exact match on a barcode or item code: {item, unit_id}, or null when no item has it. */
export async function lookupCode(code) {
  try {
    const response = await api.get("/catalog/lookup", { params: { code } });
    return response.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}
