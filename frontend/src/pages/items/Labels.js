import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import api from "../../api.js";
import { errorMessage } from "../../lib/errors.js";
import { bigMoney, plain } from "../../lib/format.js";
import { SHEETS, code128, labelCount, labelFor, layout } from "../../lib/labels.js";
import { Alert, Button, NumberInput, Select, Spinner } from "../../ui/index.js";

// The sheet size and printer nudge are remembered on this computer (and nowhere else).
function remembered(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function remember(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private window: just not remembered
  }
}

/** Rows to print from the address: ?items=12:3,15 (item id: how many) or ?bill=7 (a Goods Arrived bill). */
async function loadRows(params) {
  const items = async (ids) => Object.fromEntries((await Promise.all([...new Set(ids)].map((id) => api.get(`/catalog/items/${id}`)))).map((r) => [r.data.id, r.data]));
  if (params.get("bill")) {
    const bill = (await api.get(`/purchases/bills/${params.get("bill")}`)).data;
    const byId = await items(bill.lines.map((line) => line.item));
    return bill.lines.map((line) => {
      const item = byId[line.item];
      const unit = item.units.find((u) => u.id === line.unit);
      // Items that came with the maker's barcode don't need a sticker: unticked, but can be ticked.
      return { item, unit, count: String(labelCount(line.quantity, unit, item.base_unit)), on: !item.units.some((u) => u.barcode) };
    });
  }
  const wanted = (params.get("items") || "").split(",").filter(Boolean).map((part) => part.split(":"));
  const byId = await items(wanted.map(([id]) => id));
  return wanted.map(([id, count]) => {
    const item = byId[id];
    return { item, unit: item.units.find((u) => u.is_base), count: count || "1", on: true };
  });
}

function Label({ label, sheet, bars, rack, x, y }) {
  return (
    <div
      className="absolute flex flex-col overflow-hidden text-black"
      style={{ left: `${x}mm`, top: `${y}mm`, width: `${sheet.width}mm`, height: `${sheet.height}mm`, padding: "1mm 2mm" }}
    >
      <p className="font-semibold leading-[1.15] line-clamp-2" style={{ fontSize: `${sheet.text}pt` }}>
        {label.name}
      </p>
      <p className="font-bold leading-tight" style={{ fontSize: `${sheet.text + 1.5}pt` }}>
        {label.price ? `${bigMoney(label.price)}/${label.per}` : ""}
        {rack && label.rack ? ` · Rack ${label.rack}` : ""}
      </p>
      <div className="mt-auto">
        {bars ? (
          <svg viewBox={`-10 0 ${bars.width + 20} 1`} preserveAspectRatio="none" style={{ width: "100%", height: `${sheet.bars}mm`, display: "block" }} aria-label={`Barcode ${label.code}`}>
            <path d={bars.path} />
          </svg>
        ) : (
          <div style={{ height: `${sheet.bars}mm` }} />
        )}
        <p className="text-center leading-none tracking-wider" style={{ fontSize: `${sheet.text}pt` }}>
          {label.code}
        </p>
      </div>
    </div>
  );
}

/** Barcode labels on A4 sticker sheets (plan §19). */
export default function Labels() {
  const [params] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState(() => remembered("labels.size", "65"));
  const [startAt, setStartAt] = useState("1");
  const [rack, setRack] = useState(false);
  const [nudge, setNudge] = useState(() => remembered("labels.nudge", { x: "0", y: "0" }));
  const [bars, setBars] = useState({});
  const sheet = SHEETS[size];
  const perSheet = sheet.cols * sheet.rows;

  useEffect(() => {
    loadRows(params).then(setRows, (err) => setError(errorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const labels = useMemo(
    () => (rows || []).filter((row) => row.on).flatMap((row) => Array(Math.max(0, Math.floor(Number(row.count) || 0))).fill(labelFor(row.item, row.unit))),
    [rows],
  );
  const start = Math.min(Math.max(1, Math.floor(Number(startAt) || 1)), perSheet);
  const pages = layout(sheet, labels, start, { x: Number(nudge.x) || 0, y: Number(nudge.y) || 0 });

  // Draw each different code once.
  useEffect(() => {
    const missing = [...new Set(labels.map((label) => label.code))].filter((code) => !bars[code]);
    if (!missing.length) return;
    Promise.all(missing.map(async (code) => [code, await code128(code)]))
      .then((drawn) => setBars((current) => ({ ...current, ...Object.fromEntries(drawn) })))
      .catch((err) => setError(`Couldn't draw the barcodes: ${err.message}`));
  }, [labels, bars]);

  const setRow = (index, changes) => setRows(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  const back = params.get("back") || "/items";
  const ready = labels.every((label) => bars[label.code]);

  return (
    <div className="bg-gray-200 min-h-screen py-6 print:bg-white print:py-0">
      <style>{"@page { size: A4; margin: 0 }"}</style>
      <div className="no-print max-w-[210mm] mx-auto px-2 mb-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button to={back}>
            <ArrowLeft size={18} /> Back
          </Button>
          <h1 className="text-2xl font-bold flex-1">Print barcode labels</h1>
          <Button variant="primary" onClick={() => window.print()} disabled={!labels.length || !ready}>
            <Printer size={18} /> Print {labels.length} label{labels.length === 1 ? "" : "s"}
          </Button>
        </div>
        <Alert>{error}</Alert>
        <div className="bg-white rounded-lg border border-gray-300 p-4 grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-semibold text-gray-700 mb-1">Sticker sheet</span>
            <Select value={size} onChange={(e) => { setSize(e.target.value); remember("labels.size", e.target.value); }}>
              {Object.entries(SHEETS).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-gray-700 mb-1">Start at sticker (1–{perSheet})</span>
            <NumberInput className="w-28" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            <span className="block text-sm text-gray-500 mt-1">For a part-used sheet: 1 is top-left, then across.</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="w-5 h-5" checked={rack} onChange={(e) => setRack(e.target.checked)} />
            Show the rack on the label
          </label>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-gray-700">Printer off a little? Move by (mm):</span>
            right
            <NumberInput className="w-16 py-1" value={nudge.x} onChange={(e) => { const next = { ...nudge, x: e.target.value }; setNudge(next); remember("labels.nudge", next); }} aria-label="Move right (mm)" />
            down
            <NumberInput className="w-16 py-1" value={nudge.y} onChange={(e) => { const next = { ...nudge, y: e.target.value }; setNudge(next); remember("labels.nudge", next); }} aria-label="Move down (mm)" />
          </div>
        </div>
        <Alert kind="info">
          In the print box choose <b>Actual size / 100%</b>, margins <b>None</b>, and no headers. First time: print on plain paper and hold
          it against a sticker sheet up to the light to check it lines up.
        </Alert>

        {!rows && !error ? (
          <Spinner />
        ) : (
          rows && (
            <div className="bg-white rounded-lg border border-gray-300 divide-y divide-gray-100">
              {rows.map((row, index) => (
                <label key={index} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <input type="checkbox" className="w-5 h-5" checked={row.on} onChange={(e) => setRow(index, { on: e.target.checked })} aria-label={`Print labels for ${row.item.name}`} />
                  <span className="flex-1 min-w-[180px]">
                    <span className="font-semibold">{row.item.name}</span>
                    <span className="block text-sm text-gray-500">
                      {labelFor(row.item, row.unit).per === row.item.base_unit && row.unit && !row.unit.is_base
                        ? `${row.unit.name} has no barcode of its own: loose label (#${row.item.code})`
                        : `#${labelFor(row.item, row.unit).code}`}
                      {row.item.units.some((u) => u.barcode) && " · has the maker's barcode"}
                    </span>
                  </span>
                  <NumberInput className="w-20 py-1 text-right" value={row.count} onChange={(e) => setRow(index, { count: e.target.value, on: true })} aria-label={`How many labels for ${row.item.name}`} />
                  <span className="text-sm text-gray-500 w-12">labels</span>
                </label>
              ))}
              <p className="px-4 py-2.5 text-sm text-gray-600">
                {labels.length} label{labels.length === 1 ? "" : "s"} on {pages.length} sheet{pages.length === 1 ? "" : "s"} of {plain(perSheet)}
              </p>
            </div>
          )
        )}
      </div>

      {pages.map((page, index) => (
        <div key={index} className="relative bg-white mx-auto mb-6 shadow print:shadow-none print:m-0 overflow-hidden" style={{ width: "210mm", height: "297mm", breakAfter: "page" }}>
          {/* Sticker outlines on screen only, so you can see where they land. */}
          {Array.from({ length: perSheet }, (_, spot) => (
            <div
              key={spot}
              className={`absolute border border-dashed print:hidden ${index === 0 && spot < start - 1 ? "bg-gray-100 border-gray-300" : "border-gray-200"}`}
              style={{
                left: `${sheet.left + (spot % sheet.cols) * sheet.across}mm`,
                top: `${sheet.top + Math.floor(spot / sheet.cols) * sheet.down}mm`,
                width: `${sheet.width}mm`,
                height: `${sheet.height}mm`,
              }}
            />
          ))}
          {page.map(({ x, y, label }, spot) => (
            <Label key={spot} label={label} sheet={sheet} bars={bars[label.code]} rack={rack} x={x} y={y} />
          ))}
        </div>
      ))}
    </div>
  );
}
