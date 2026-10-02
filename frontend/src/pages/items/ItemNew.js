import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDownToLine, Download, FileSpreadsheet, Plus, Trash2, Wand2 } from "lucide-react";
import api from "../../api.js";
import { useAuth } from "../../context/AuthContext.js";
import { A } from "../../lib/access.js";
import { useFetch } from "../../hooks/useFetch.js";
import { useGoBack } from "../../hooks/useTrail.js";
import { SAMPLE_SHEET_NAME, SAMPLE_SHEET_URL, downloadFile } from "../../lib/download.js";
import { errorMessage } from "../../lib/errors.js";
import { BASE_UNITS, GST_RATES } from "../../lib/format.js";
import { Alert, Button, Card, DonePanel, Field, GoHomeButton, Input, PageHeader, Select, inputClass } from "../../ui/index.js";

let nextKey = 1;
const blankRow = (variant = "") => ({
  key: nextKey++,
  variant,
  selling_price: "",
  mrp: "",
  barcode: "",
  pack_price: "",
  pack_mrp: "",
  pack_barcode: "",
  rack: "",
  min_stock: "",
});

const COLUMNS = [
  ["variant", "Variant (size / colour)", "w-48"],
  ["selling_price", "Price / unit", "w-28"],
  ["mrp", "MRP / unit", "w-28"],
  ["barcode", "Unit barcode", "w-40"],
  ["pack_price", "Pack price", "w-28", true],
  ["pack_mrp", "Pack MRP", "w-28", true],
  ["pack_barcode", "Pack barcode", "w-40", true],
  ["rack", "Rack", "w-20"],
  ["min_stock", "Min stock", "w-24"],
];

const DECIMALS = ["selling_price", "mrp", "pack_price", "pack_mrp", "min_stock"];

function splitList(text) {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function variantsPayload(rows, hasPack) {
  return rows.map((row) => {
    const variant = { variant: row.variant.trim() };
    COLUMNS.forEach(([key, , , packOnly]) => {
      if (key === "variant" || (packOnly && !hasPack)) return;
      const value = String(row[key] ?? "").trim();
      if (value !== "") variant[key] = value;
      else if (DECIMALS.includes(key) && key !== "min_stock") variant[key] = null;
    });
    return variant;
  });
}

/** Pointer to the Excel route for adding many items at once. */
function ExcelHint() {
  const { can } = useAuth();
  const [error, setError] = useState("");

  async function download() {
    setError("");
    try {
      await downloadFile(SAMPLE_SHEET_URL, SAMPLE_SHEET_NAME);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card className="p-4 mb-6 bg-green-50/60 border-green-200">
      <div className="flex flex-wrap items-center gap-4">
        <FileSpreadsheet className="text-green-700 shrink-0" size={28} />
        <div className="flex-1 min-w-[260px]">
          <p className="font-semibold">Adding many items? Fill them in Excel instead.</p>
          <p className="text-sm text-gray-700">
            The sample sheet shows the format: one row per size/colour, with packs, prices, rack and what's on the shelf.{" "}
            {can(A.IMPORT) ? (
              <>
                Upload it under{" "}
                <Link to="/import" className="underline font-semibold">
                  Upload from Excel
                </Link>
                .
              </>
            ) : (
              "Give the filled sheet to the owner to upload."
            )}
          </p>
          {error && <p className="text-sm text-red-700 mt-1">{error}</p>}
        </div>
        <Button onClick={download}>
          <Download size={18} /> Download sample sheet
        </Button>
      </div>
    </Card>
  );
}

export default function ItemNew() {
  const navigate = useNavigate();
  const { data: brands } = useFetch("/catalog/brands");
  const { data: categories, reload: reloadCategories } = useFetch("/catalog/categories");
  const [product, setProduct] = useState({
    brand: "",
    name: "",
    category: "",
    hsn_code: "",
    gst_rate: "18",
    base_unit: "pc",
    description: "",
  });
  const [hasPack, setHasPack] = useState(false);
  const [pack, setPack] = useState({ name: "", factor: "" });
  const [rows, setRows] = useState([blankRow()]);
  const [sizes, setSizes] = useState("");
  const [colours, setColours] = useState("");
  const [error, setError] = useState("");
  const [existingId, setExistingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // what was just saved, for the "done" screen
  const back = useGoBack("/items", "All Items");

  const setField = (key) => (event) => setProduct({ ...product, [key]: event.target.value });
  const setCell = (key, field, value) => setRows(rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));

  function generate() {
    const sizeList = splitList(sizes);
    const colourList = splitList(colours);
    const names = sizeList.length && colourList.length
      ? sizeList.flatMap((size) => colourList.map((colour) => `${size} ${colour}`))
      : [...sizeList, ...colourList];
    const existing = new Set(rows.map((row) => row.variant.trim().toLowerCase()));
    const fresh = names.filter((name) => !existing.has(name.toLowerCase())).map((name) => blankRow(name));
    const kept = rows.filter((row) => Object.entries(row).some(([key, value]) => key !== "key" && value));
    setRows([...kept, ...fresh]);
  }

  function fillDown(field) {
    const first = rows[0]?.[field] ?? "";
    setRows(rows.map((row) => ({ ...row, [field]: first })));
  }

  function nextRowOnEnter(event, rowIndex, field) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    document.querySelector(`[data-cell="${rowIndex + 1}-${field}"]`)?.focus();
  }

  async function addCategory() {
    const name = window.prompt("New category name");
    if (!name?.trim()) return;
    try {
      const response = await api.post("/catalog/categories", { name: name.trim() });
      await reloadCategories();
      setProduct((current) => ({ ...current, category: String(response.data.id) }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function variantsBody() {
    return {
      base_unit: product.base_unit,
      pack: hasPack ? { name: pack.name.trim(), factor: pack.factor } : null,
      variants: variantsPayload(rows, hasPack),
    };
  }

  async function save(intoExisting = false) {
    setError("");
    setSaving(true);
    try {
      if (intoExisting) {
        await api.post(`/catalog/products/${existingId}/variants`, variantsBody());
      } else {
        await api.post("/catalog/products", {
          ...product,
          category: product.category || null,
          ...variantsBody(),
        });
      }
      setDone({
        count: rows.length,
        name: [product.brand.trim(), product.name.trim()].filter(Boolean).join(" "),
        variants: rows.map((row) => row.variant.trim()).filter(Boolean),
      });
    } catch (err) {
      setExistingId(err.response?.data?.product_id ?? null);
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    const one = done.count === 1;
    return (
      <DonePanel
        title={one ? "Item added" : `${done.count} items added`}
        detail={done.variants.length ? `${done.name} — ${done.variants.join(", ")}` : done.name}
        note={`${one ? "It" : "They"} can be billed now. Stock shows once you count ${one ? "it" : "them"} or enter a purchase bill.`}
      >
        <GoHomeButton />
        {/* Opening the form again (replacing this page) gives a fresh, empty form. */}
        <Button className="h-14 text-lg" onClick={() => navigate("/items/new", { replace: true })}>
          <Plus size={20} /> Add another item
        </Button>
        <Link
          to={`/items?search=${encodeURIComponent(product.name.trim())}`}
          className="self-center p-2 font-semibold text-blue-800 hover:underline"
        >
          See {one ? "this item" : "these items"}
        </Link>
      </DonePanel>
    );
  }

  const unitLabel = product.base_unit;
  const visibleColumns = COLUMNS.filter(([, , , packOnly]) => hasPack || !packOnly);

  return (
    <>
      <PageHeader title="Add New Item" back={["/items", "All Items"]} subtitle="One product, with all its sizes and colours" />
      <ExcelHint />

      <Card className="p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">Product</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Brand" hint="Blank for unbranded goods">
            <Input list="brands" value={product.brand} onChange={setField("brand")} placeholder="e.g. Havells" />
            <datalist id="brands">
              {(brands || []).map((brand) => (
                <option key={brand.id} value={brand.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Product name *" className="md:col-span-2">
            <Input value={product.name} onChange={setField("name")} placeholder="e.g. Lifeline Plus HRFR wire" />
          </Field>
          <Field label="Category">
            <div className="flex gap-2">
              <Select value={product.category} onChange={setField("category")}>
                <option value="">— none —</option>
                {(categories || []).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
              <Button onClick={addCategory} aria-label="New category" title="New category">
                <Plus size={18} />
              </Button>
            </div>
          </Field>
          <Field label="HSN code" hint="4, 6 or 8 digits">
            <Input value={product.hsn_code} onChange={setField("hsn_code")} inputMode="numeric" />
          </Field>
          <Field label="GST %">
            <Select value={product.gst_rate} onChange={setField("gst_rate")}>
              {GST_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sold in" hint="The smallest unit you sell. Stock is kept in this unit.">
            <Select value={product.base_unit} onChange={setField("base_unit")}>
              {BASE_UNITS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label} ({value})
                </option>
              ))}
            </Select>
          </Field>
          <div className="md:col-span-2 flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 font-semibold py-2">
              <input type="checkbox" checked={hasPack} onChange={(event) => setHasPack(event.target.checked)} className="w-5 h-5" />
              Also bought or sold in packs
            </label>
            {hasPack && (
              <>
                <Field label="Pack name">
                  <Input list="packs" value={pack.name} onChange={(e) => setPack({ ...pack, name: e.target.value })} placeholder="coil" />
                  <datalist id="packs">
                    {["coil", "box", "bundle", "packet", "carton", "roll"].map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </Field>
                <Field label={`${unitLabel} in one ${pack.name || "pack"}`}>
                  <Input value={pack.factor} onChange={(e) => setPack({ ...pack, factor: e.target.value })} inputMode="decimal" placeholder="90" />
                </Field>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="font-bold text-lg">Variants</h2>
            <p className="text-sm text-gray-600">
              One row per size/colour. Leave the variant blank if the product has none. Prices include GST.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Sizes">
              <Input value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="1 sq mm, 1.5 sq mm, 2.5 sq mm" />
            </Field>
            <Field label="Colours">
              <Input value={colours} onChange={(e) => setColours(e.target.value)} placeholder="Red, Black, Yellow" />
            </Field>
            <Button onClick={generate} disabled={!sizes.trim() && !colours.trim()}>
              <Wand2 size={18} /> Make rows
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="text-left">
            <thead>
              <tr>
                {visibleColumns.map(([key, label, width]) => (
                  <th key={key} className={`px-1 pb-2 text-xs font-bold text-gray-500 ${width}`}>
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {key !== "variant" && key !== "barcode" && key !== "pack_barcode" && rows.length > 1 && (
                        <button
                          type="button"
                          title="Copy first row to all rows"
                          aria-label={`Copy first row's ${label} to all rows`}
                          onClick={() => fillDown(key)}
                          className="text-blue-700"
                        >
                          <ArrowDownToLine size={14} />
                        </button>
                      )}
                    </span>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key}>
                  {visibleColumns.map(([key, label, width]) => (
                    <td key={key} className={`px-1 py-1 ${width}`}>
                      <input
                        className={`${inputClass} px-2 py-1.5`}
                        value={row[key]}
                        aria-label={`${label} row ${index + 1}`}
                        data-cell={`${index}-${key}`}
                        inputMode={DECIMALS.includes(key) ? "decimal" : undefined}
                        onChange={(event) => setCell(row.key, key, event.target.value)}
                        onKeyDown={(event) => nextRowOnEnter(event, index, key)}
                      />
                    </td>
                  ))}
                  <td className="px-1">
                    <button
                      type="button"
                      aria-label={`Remove row ${index + 1}`}
                      disabled={rows.length === 1}
                      onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button className="mt-3" onClick={() => setRows([...rows, blankRow()])}>
          <Plus size={18} /> Add row
        </Button>
      </Card>

      <Alert>
        {error && (
          <>
            {error}
            {existingId && (
              <div className="mt-2">
                <Button variant="primary" onClick={() => save(true)} disabled={saving}>
                  Add these as new variants of the existing product
                </Button>
              </div>
            )}
          </>
        )}
      </Alert>
      <div className="flex gap-3">
        <Button variant="primary" onClick={() => save(false)} disabled={saving || !product.name.trim()}>
          {saving ? "Saving…" : `Save ${rows.length} item${rows.length === 1 ? "" : "s"}`}
        </Button>
        <Button onClick={back.go}>Cancel</Button>
      </div>
    </>
  );
}
