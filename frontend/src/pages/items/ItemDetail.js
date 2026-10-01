import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import api from "../../api.js";
import { useAuth } from "../../context/AuthContext.js";
import { useFetch } from "../../hooks/useFetch.js";
import { errorMessage } from "../../lib/errors.js";
import { BASE_UNITS, GST_RATES, dateTime, money, plain, signed } from "../../lib/format.js";
import { Alert, BackLink, Button, Card, Empty, Field, Input, Modal, NumberInput, Select, Spinner, Table, td, th } from "../../ui/index.js";
import { StatusBadges } from "./ItemList.js";
import AdjustModal from "../stock/AdjustModal.js";

function Info({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5">{children || "—"}</dd>
    </div>
  );
}

function EditItemModal({ item, isOwner, hasHistory, onClose, onSaved }) {
  const [form, setForm] = useState({
    variant: item.variant,
    rack: item.rack,
    min_stock: plain(item.min_stock),
    aliases: item.aliases,
    selling_price: item.selling_price ?? "",
    mrp: item.mrp ?? "",
    is_active: item.is_active,
    base_unit: item.base_unit,
  });
  const [error, setError] = useState("");
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function save() {
    const body = { variant: form.variant, rack: form.rack, min_stock: form.min_stock || "0", aliases: form.aliases };
    if (!hasHistory) body.base_unit = form.base_unit;
    if (isOwner) {
      body.selling_price = form.selling_price === "" ? null : form.selling_price;
      body.mrp = form.mrp === "" ? null : form.mrp;
      body.is_active = form.is_active;
    }
    try {
      onSaved((await api.patch(`/catalog/items/${item.id}`, body)).data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal title="Edit item" onClose={onClose}>
      <Alert>{error}</Alert>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Variant" className="col-span-2">
          <Input value={form.variant} onChange={set("variant")} />
        </Field>
        <Field label="Rack">
          <Input value={form.rack} onChange={set("rack")} />
        </Field>
        <Field label={`Min stock (${item.base_unit})`}>
          <NumberInput value={form.min_stock} onChange={set("min_stock")} />
        </Field>
        <Field label="Other names (aliases)" className="col-span-2" hint="Comma separated, e.g. kit-kat, fuse carrier">
          <Input value={form.aliases} onChange={set("aliases")} />
        </Field>
        {!hasHistory && (
          <Field label="Sold in" className="col-span-2" hint="Can't change once stock has moved.">
            <Select value={form.base_unit} onChange={set("base_unit")}>
              {BASE_UNITS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label} ({value})
                </option>
              ))}
            </Select>
          </Field>
        )}
        {isOwner && (
          <>
            <Field label={`Selling price / ${item.base_unit}`} hint="GST included">
              <NumberInput value={form.selling_price} onChange={set("selling_price")} />
            </Field>
            <Field label={`MRP / ${item.base_unit}`}>
              <NumberInput value={form.mrp} onChange={set("mrp")} />
            </Field>
            <label className="col-span-2 flex items-center gap-2">
              <input type="checkbox" checked={!form.is_active} onChange={(e) => setForm({ ...form, is_active: !e.target.checked })} className="w-5 h-5" />
              Inactive (no longer stocked — hidden from lists, history kept)
            </label>
          </>
        )}
      </div>
      <div className="flex gap-3 mt-6">
        <Button variant="primary" onClick={save}>
          Save
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

function EditProductModal({ item, onClose, onSaved }) {
  const { data: categories } = useFetch("/catalog/categories");
  const [form, setForm] = useState({
    name: item.product_name,
    category: item.category_id ?? "",
    hsn_code: item.hsn_code,
    gst_rate: String(Number(item.gst_rate)),
  });
  const [error, setError] = useState("");
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function save() {
    try {
      await api.patch(`/catalog/products/${item.product}`, { ...form, category: form.category || null });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal title="Edit product (all its variants)" onClose={onClose}>
      <Alert>{error}</Alert>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Product name" className="col-span-2">
          <Input value={form.name} onChange={set("name")} />
        </Field>
        <Field label="Category" className="col-span-2">
          <Select value={form.category} onChange={set("category")}>
            <option value="">— none —</option>
            {(categories || []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="HSN code">
          <Input value={form.hsn_code} onChange={set("hsn_code")} />
        </Field>
        <Field label="GST %">
          <Select value={form.gst_rate} onChange={set("gst_rate")}>
            {GST_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}%
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex gap-3 mt-6">
        <Button variant="primary" onClick={save}>
          Save
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

function Units({ item, isOwner, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", factor: "", barcode: "", mrp: "", selling_price: "" });
  const [error, setError] = useState("");

  async function run(request) {
    setError("");
    try {
      onChanged((await request()).data);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  }

  async function addPack() {
    const body = { name: form.name, factor: form.factor, barcode: form.barcode };
    if (isOwner) Object.assign(body, { mrp: form.mrp, selling_price: form.selling_price });
    if (await run(() => api.post(`/catalog/items/${item.id}/units`, body))) {
      setAdding(false);
      setForm({ name: "", factor: "", barcode: "", mrp: "", selling_price: "" });
    }
  }

  function editBarcode(unit) {
    const barcode = window.prompt(`Barcode for ${unit.name} (scan or type; blank to remove)`, unit.barcode || "");
    if (barcode !== null) run(() => api.patch(`/catalog/units/${unit.id}`, { barcode }));
  }

  async function remove(unit) {
    if (!window.confirm(`Remove the ${unit.name} unit?`)) return;
    setError("");
    try {
      await api.delete(`/catalog/units/${unit.id}`);
      onChanged((await api.get(`/catalog/items/${item.id}`)).data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h2 className="font-bold text-lg">Units & barcodes</h2>
        <Button onClick={() => setAdding(!adding)}>
          <Plus size={18} /> Add pack
        </Button>
      </div>
      <div className="px-5">
        <Alert>{error}</Alert>
      </div>
      <Table>
        <thead>
          <tr>
            <th className={th}>Unit</th>
            <th className={th}>Size</th>
            <th className={th}>Barcode</th>
            <th className={`${th} text-right`}>MRP</th>
            <th className={`${th} text-right`}>Price</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {item.units.map((unit) => (
            <tr key={unit.id}>
              <td className={`${td} font-semibold`}>{unit.name}{unit.is_base && <span className="text-gray-500 font-normal"> (base)</span>}</td>
              <td className={td}>{unit.is_base ? "1" : `${plain(unit.factor)} ${item.base_unit}`}</td>
              <td className={`${td} font-mono text-sm`}>
                <button type="button" onClick={() => editBarcode(unit)} className="hover:underline text-blue-800">
                  {unit.barcode || "add barcode"}
                </button>
              </td>
              <td className={`${td} text-right`}>{money(unit.is_base ? item.mrp : unit.mrp)}</td>
              <td className={`${td} text-right`}>
                {unit.is_base
                  ? money(item.selling_price)
                  : unit.selling_price
                    ? money(unit.selling_price)
                    : item.selling_price && (
                        <span className="text-gray-500" title="Base price × size">
                          {money(Number(item.selling_price) * Number(unit.factor))}
                        </span>
                      )}
              </td>
              <td className={`${td} text-right`}>
                {!unit.is_base && (
                  <button type="button" aria-label={`Remove ${unit.name}`} onClick={() => remove(unit)} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={18} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {adding && (
        <div className="p-5 border-t bg-gray-50 grid md:grid-cols-6 gap-3 items-end">
          <Field label="Pack name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="box" />
          </Field>
          <Field label={`${item.base_unit} per pack`}>
            <NumberInput value={form.factor} onChange={(e) => setForm({ ...form, factor: e.target.value })} />
          </Field>
          <Field label="Barcode">
            <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          </Field>
          {isOwner && (
            <>
              <Field label="Pack MRP">
                <NumberInput value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
              </Field>
              <Field label="Pack price">
                <NumberInput value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
              </Field>
            </>
          )}
          <Button variant="primary" onClick={addPack} disabled={!form.name || !form.factor}>
            Add
          </Button>
        </div>
      )}
    </Card>
  );
}

function History({ itemId, isOwner, version }) {
  const [rows, setRows] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(page = 1) {
    setLoading(true);
    try {
      const response = await api.get(`/catalog/items/${itemId}/movements`, { params: { page } });
      setRows((current) => (page === 1 ? response.data.results : [...current, ...response.data.results]));
      setNext(response.data.next ? page + 1 : null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, version]);

  return (
    <Card>
      <h2 className="font-bold text-lg px-5 py-4 border-b">Stock history</h2>
      <Alert>{error}</Alert>
      {rows.length === 0 && !loading ? (
        <Empty>No stock movements yet.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>When</th>
              <th className={th}>What</th>
              <th className={`${th} text-right`}>Change</th>
              <th className={`${th} text-right`}>Balance</th>
              {isOwner && <th className={`${th} text-right`}>Cost / unit</th>}
              <th className={th}>Note</th>
              <th className={th}>By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={`${td} whitespace-nowrap`}>{dateTime(row.created_at)}</td>
                <td className={td}>{row.kind_display}</td>
                <td className={`${td} text-right font-semibold ${Number(row.quantity) < 0 ? "text-red-700" : "text-green-700"}`}>
                  {signed(row.quantity)}
                </td>
                <td className={`${td} text-right`}>{plain(row.balance_after)}</td>
                {isOwner && <td className={`${td} text-right text-gray-600`}>{money(row.unit_cost)}</td>}
                <td className={`${td} text-sm text-gray-600`}>{row.note}</td>
                <td className={`${td} text-sm`}>{row.created_by}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {next && (
        <div className="p-4 text-center">
          <Button onClick={() => load(next)} disabled={loading}>
            Load older
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function ItemDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const { data: item, error, loading, setData, reload } = useFetch(`/catalog/items/${id}`);
  const [modal, setModal] = useState(null);
  const [version, setVersion] = useState(0);
  const [hasHistory, setHasHistory] = useState(true);

  useEffect(() => {
    api.get(`/catalog/items/${id}/movements`, { params: { page_size: 1 } })
      .then((response) => setHasHistory(response.data.count > 0))
      .catch(() => setHasHistory(true));
  }, [id, version]);

  if (loading && !item) return <Spinner />;
  if (!item) return <Alert>{error || "Item not found."}</Alert>;

  return (
    <>
      <div className="mb-1">
        <BackLink to="/items">All Items</BackLink>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{item.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-gray-600">
            <span className="font-mono">#{item.code}</span>
            <StatusBadges item={item} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModal("item")}>
            <Pencil size={18} /> Edit
          </Button>
          {isOwner && (
            <>
              <Button onClick={() => setModal("product")}>
                <Pencil size={18} /> Product, HSN & GST
              </Button>
              <Button variant="primary" onClick={() => setModal("adjust")}>
                <SlidersHorizontal size={18} /> Fix stock
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-6">
          <p className="text-sm font-semibold text-gray-500">In stock</p>
          <p className={`text-4xl font-bold mt-1 ${Number(item.stock_qty) < 0 ? "text-red-700" : ""}`}>{item.stock_display}</p>
          <p className="text-sm text-gray-500 mt-2">
            {item.counted_at ? `Last checked ${dateTime(item.counted_at)}` : "Not checked yet — this number isn't confirmed."}
          </p>
          {Number(item.min_stock) > 0 && <p className="text-sm text-gray-500">Reorder at {plain(item.min_stock)} {item.base_unit}</p>}
        </Card>
        <Card className="p-6 lg:col-span-2">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Info label="Price">{item.selling_price && `${money(item.selling_price)} / ${item.base_unit}`}</Info>
            <Info label="MRP">{item.mrp && `${money(item.mrp)} / ${item.base_unit}`}</Info>
            {isOwner && <Info label="Average cost">{item.cost_price && `${money(item.cost_price)} / ${item.base_unit}`}</Info>}
            <Info label="Rack">{item.rack}</Info>
            <Info label="Category">{item.category}</Info>
            <Info label="HSN">{item.hsn_code}</Info>
            <Info label="GST">{`${plain(item.gst_rate)}%`}</Info>
            <Info label="Other names">{item.aliases}</Info>
          </dl>
        </Card>
      </div>

      <Units item={item} isOwner={isOwner} onChanged={setData} />
      <History itemId={item.id} isOwner={isOwner} version={version} />

      {modal === "item" && (
        <EditItemModal
          item={item}
          isOwner={isOwner}
          hasHistory={hasHistory}
          onClose={() => setModal(null)}
          onSaved={(updated) => {
            setData(updated);
            setModal(null);
          }}
        />
      )}
      {modal === "product" && (
        <EditProductModal
          item={item}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal === "adjust" && (
        <AdjustModal
          item={item}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            reload();
            setVersion((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
