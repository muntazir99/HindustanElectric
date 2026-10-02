// Reading barcodes and QR codes with a phone's camera.
// Chrome on Android has a reader built in (BarcodeDetector). Other browsers (iPhone, most desktops) use the
// ZXing reader instead, loaded only when the camera first opens. Its .wasm file is served from our own site.

export const FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "itf",
  "qr_code",
  "data_matrix",
];

let detector = null;

/** The barcode reader, created once. */
export function getDetector() {
  detector ??= (async () => {
    const Native = globalThis.BarcodeDetector;
    if (Native) {
      try {
        const supported = await Native.getSupportedFormats();
        const formats = FORMATS.filter((format) => supported.includes(format));
        // Shop items are mostly EAN-13; distributors' boxes often Code 128.
        if (formats.includes("ean_13") && formats.includes("code_128")) return new Native({ formats });
      } catch {
        // fall back to ZXing below
      }
    }
    const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
      import("barcode-detector/ponyfill"),
      import("zxing-wasm/reader/zxing_reader.wasm?url"),
    ]);
    prepareZXingModule({
      overrides: { locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) },
    });
    return new BarcodeDetector({ formats: FORMATS });
  })();
  detector.catch(() => {
    detector = null; // try again next time
  });
  return detector;
}

/** Whether this device has a camera the page could use. Asks no permission. */
export async function hasCamera() {
  if (!globalThis.isSecureContext || !navigator.mediaDevices?.enumerateDevices) return false;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((device) => device.kind === "videoinput");
  } catch {
    return false;
  }
}

/**
 * While the camera rests on one barcode it reads it many times a second. This lets a code through once,
 * then again only after it has been out of view for `gapMs`: point away and back to scan the same item again.
 */
export function scanGate(gapMs = 1500) {
  let last = null;
  return (code, now) => {
    if (last && last.code === code && now - last.seen < gapMs) {
      last.seen = now;
      return false;
    }
    last = { code, seen: now };
    return true;
  };
}

/** The back cameras, once the camera is allowed (before that, browsers hide the names). */
export function backCameras(devices) {
  return devices.filter((device) => device.kind === "videoinput" && /back|rear|environment/i.test(device.label));
}

/**
 * Which back camera to read barcodes with. Phones like the Galaxy S23 have several (main, ultra-wide, zoom),
 * and the browser may open the ultra-wide, which can't focus close: every barcode looks blurry. Android names
 * them "camera2 0, facing back", "camera2 2, facing back"…, and number 0 is the main camera.
 * Returns a deviceId, or null to keep the browser's choice.
 */
export function pickBackCamera(devices, remembered) {
  const backs = backCameras(devices);
  if (remembered && backs.some((device) => device.deviceId === remembered)) return remembered;
  if (backs.length < 2) return null;
  const numbered = backs
    .map((device) => ({ id: device.deviceId, number: Number(/camera2 (\d+)/i.exec(device.label)?.[1]) }))
    .filter((camera) => Number.isInteger(camera.number))
    .sort((a, b) => a.number - b.number);
  return numbered[0]?.id ?? null;
}

/** Zoom choices the camera allows, from 1x up to 3x. */
export function zoomSteps(capabilities) {
  const range = capabilities?.zoom;
  if (!range || !(range.max > range.min)) return [];
  return [1, 1.5, 2, 3].filter((step) => step >= range.min && step <= range.max);
}

/**
 * Start at 2x where possible: the phone is held 15–20 cm away, where it can focus, and the barcode
 * still fills the frame.
 */
export function startZoom(capabilities) {
  const steps = zoomSteps(capabilities);
  if (!steps.length) return null;
  return steps.includes(2) ? 2 : steps[steps.length - 1];
}

/** What to tell the person when the camera won't start. */
export function cameraProblem(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "The camera isn't allowed for this site. Allow it in the browser's settings, then try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera found on this device.";
    case "NotReadableError":
      return "The camera is being used by another app. Close it and try again.";
    default:
      return "The camera couldn't start. Use a barcode scanner or type the name instead.";
  }
}
