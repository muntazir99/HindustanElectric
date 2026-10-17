// Barcode labels (plan §19): Code 128 of the item's code (or a pack's own barcode) on A4 sticker sheets.
// The scan lookup already finds an item by its code, so a printed label works at the counter at once.

/** Ready-cut A4 sticker sheets, in mm. `text` is the name size in pt, `bars` the barcode height in mm. */
export const SHEETS = {
  65: { name: "65 per sheet (38 × 21 mm)", cols: 5, rows: 13, width: 38.1, height: 21.2, left: 4.7, top: 10.7, across: 40.6, down: 21.2, text: 6.5, bars: 7 },
  24: { name: "24 per sheet (64 × 34 mm)", cols: 3, rows: 8, width: 63.5, height: 33.9, left: 7.2, top: 12.9, across: 66, down: 33.9, text: 8, bars: 11 },
  12: { name: "12 per sheet (64 × 72 mm)", cols: 3, rows: 4, width: 63.5, height: 72, left: 7.2, top: 4.5, across: 66, down: 72, text: 11, bars: 22 },
};

/**
 * Where each label goes: one array per A4 page of {x, y, label} in mm from the sheet's top-left.
 * startAt (1 = top-left sticker) skips stickers already used on the first sheet; nudge moves everything
 * a little for a printer that doesn't print exactly where it's told.
 */
export function layout(sheet, labels, startAt = 1, nudge = { x: 0, y: 0 }) {
  const perSheet = sheet.cols * sheet.rows;
  const pages = [];
  labels.forEach((label, index) => {
    const slot = startAt - 1 + index;
    const spot = slot % perSheet;
    (pages[Math.floor(slot / perSheet)] ??= []).push({
      x: sheet.left + (spot % sheet.cols) * sheet.across + nudge.x,
      y: sheet.top + Math.floor(spot / sheet.cols) * sheet.down + nudge.y,
      label,
    });
  });
  return pages.filter(Boolean);
}

/** The label for an item sold in `unit`: a pack with its own barcode gets a pack label, anything else the item's own. */
export function labelFor(item, unit) {
  const pack = unit && !unit.is_base && unit.barcode ? unit : null;
  const base = item.units.find((u) => u.is_base);
  const price = pack ? (pack.selling_price ?? (item.selling_price && Number(item.selling_price) * Number(pack.factor))) : item.selling_price;
  return {
    code: pack ? pack.barcode : base?.barcode || item.code,
    name: item.name,
    price,
    per: pack ? pack.name : item.base_unit,
    rack: item.rack,
  };
}

/** Dark runs in one row of barcode modules (0 = dark): [[start, width], ...]. */
export function runs(row) {
  const out = [];
  for (let x = 0; x < row.length; x++) {
    if (row[x] !== 0) continue;
    const last = out.at(-1);
    if (last && last[0] + last[1] === x) last[1]++;
    else out.push([x, 1]);
  }
  return out;
}

let writer;

/**
 * Code 128 for `text` as {width, path}: the bars as an SVG path, one unit per module, one unit high, so it
 * stretches to any label. Drawn by the zxing library the camera scanner already uses; no new package.
 */
export async function code128(text) {
  writer ??= Promise.all([import("zxing-wasm/writer"), import("zxing-wasm/writer/zxing_writer.wasm?url")]).then(([zxing, { default: wasmUrl }]) => {
    zxing.prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) } });
    return zxing;
  });
  const { writeBarcode } = await writer;
  const { symbol, error } = await writeBarcode(text, { format: "Code128" });
  if (error) throw new Error(error);
  const bars = runs(symbol.data.subarray(0, symbol.width));
  return { width: symbol.width, path: bars.map(([x, w]) => `M${x} 0h${w}v1h-${w}Z`).join("") };
}

/** Labels for a received bill line: one per piece or pack; one for loose metres, feet, kilos or litres. */
export function labelCount(quantity, unit, baseUnit) {
  return unit.is_base && ["m", "ft", "kg", "l"].includes(baseUnit) ? 1 : Math.ceil(Number(quantity));
}
