import api from "../api.js";

/** Download a file from the API (with the login token) and save it under `filename`. */
export async function downloadFile(url, filename) {
  const response = await api.get(url, { responseType: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(response.data);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export const SAMPLE_SHEET_URL = "/import/catalogue/sample";
export const SAMPLE_SHEET_NAME = "hindustan-electric-sample-items.xlsx";
