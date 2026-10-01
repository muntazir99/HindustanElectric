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

/**
 * Open a protected file (e.g. a bill photo) in a new tab. The file needs the login token, so it is
 * fetched first; the tab is opened straight away so the browser doesn't block it as a pop-up.
 */
export async function openFile(url) {
  const tab = window.open("", "_blank");
  try {
    const response = await api.get(url, { responseType: "blob" });
    const objectUrl = URL.createObjectURL(response.data);
    if (tab) tab.location.href = objectUrl;
    else window.location.assign(objectUrl);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
