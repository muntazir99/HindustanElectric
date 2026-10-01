import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Paperclip, Plus, Trash2 } from "lucide-react";
import api from "../../api.js";
import ItemSearch from "../../components/ItemSearch.js";
import { useFetch } from "../../hooks/useFetch.js";
import { useGoBack } from "../../hooks/useTrail.js";
import { errorMessage } from "../../lib/errors.js";
import { GST_RATES, date, money, plain, plural, round2, today } from "../../lib/format.js";
import {
  Alert,
  BackLink,
  Badge,
  Button,
  Card,
  DonePanel,
  Field,
  GoHomeButton,
  Input,
  Modal,
  NumberInput,
  Select,
  Spinner,
  inputClass,
} from "../../ui/index.js";
import QuickItemModal from "../items/QuickItemModal.js";

let nextKey = 1;

function lineFromItem(item, unitId) {
  return {
    key: nextKey++,
    item: item.id,
    item_name: item.name,
    item_code: item.code,
    base_unit: item.base_unit,
    units: item.units.map(({ id, name, factor, is_base }) => ({ id, name, factor, is_base })),
    unit: unitId,
    quantity: "1",
    rate: "",
    discount_percent: "0",
    gst_rate: plain(item.gst_rate),
  };
}

function lineFromServer(line) {
  return {
    key: nextKey++,
    item: line.item,
    item_name: line.item_name,
    item_code: line.item_code,
    base_unit: line.base_unit,
    units: line.item_units,
    unit: line.unit,
    quantity: plain(line.quantity),
    rate: plain(line.rate),
    discount_percent: plain(line.discount_percent),
    gst_rate: plain(line.gst_rate),
  };
}

/** Same arithmetic as the server (PurchaseLine.save); the server's figures are final. */
export function lineAmounts(line) {
  const gross = Number(line.quantity || 0) * Number(line.rate || 0);
  const taxable = round2(gross - (gross * Number(line.discount_percent || 0)) / 100);
  const tax = round2((taxable * Number(line.gst_rate || 0)) / 100);
  return { taxable, tax };
}

function SupplierModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", phone: "", gstin: "" });
  const [error, setError] = useState("");
  async function save() {
    try {
      onCreated((await api.post("/purchases/suppliers", form)).data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <Modal title="Add distributor" onClose={onClose}>
      <Alert>{error}</Alert>
      <div className="grid gap-4">
        <Field label="Name *">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="GSTIN">
          <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
        </Field>
      </div>
      <div className="flex gap-3 mt-6">
        <Button variant="primary" onClick={save} disabled={!form.name.trim()}>
          Save distributor
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

function PostedBill({ bill }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-xs uppercase text-gray-500 bg-gray-50">
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Rate</th>
            <th className="px-4 py-3 text-right">Disc %</th>
            <th className="px-4 py-3 text-right">GST %</th>
            <th className="px-4 py-3 text-right">Taxable</th>
            <th className="px-4 py-3 text-right">GST</th>
          </tr>
        </thead>
        <tbody>
          {bill.lines.map((line) => (
            <tr key={line.id} className="border-t">
              <td className="px-4 py-2">
                <Link to={`/items/${line.item}`} className="hover:underline font-semibold">
                  {line.item_name}
                </Link>
              </td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                {plain(line.quantity)} {line.unit_name}
              </td>
              <td className="px-4 py-2 text-right">{money(line.rate)}</td>
              <td className="px-4 py-2 text-right">{plain(line.discount_percent)}</td>
              <td className="px-4 py-2 text-right">{plain(line.gst_rate)}</td>
              <td className="px-4 py-2 text-right">{money(line.taxable_amount)}</td>
              <td className="px-4 py-2 text-right">{money(line.tax_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function PurchaseEntry() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = !id;
  const { data: suppliers, reload: reloadSuppliers } = useFetch("/purchases/suppliers");
  const { data: loaded, error: loadError, loading } = useFetch(isNew ? null : `/purchases/bills/${id}`);

  const [bill, setBill] = useState(null);
  const [header, setHeader] = useState({ supplier: "", bill_number: "", bill_date: today(), notes: "", round_off: "0" });
  const [lines, setLines] = useState([]);
  const [paperTotal, setPaperTotal] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  // After "Add to stock": say it's done and what to do next, instead of leaving the bill on screen.
  const [done, setDone] = useState(Boolean(location.state?.added));
  const back = useGoBack("/purchases", "Purchase Bills");

  // A message carried over from the previous screen is shown once, not again on reload.
  useEffect(() => {
    if (location.state?.notice || location.state?.added) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before a refresh or tab close throws away lines that were never saved.
  const unsaved = !bill && lines.length > 0;
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  useEffect(() => {
    if (!loaded) return;
    setBill(loaded);
    setHeader({
      supplier: String(loaded.supplier),
      bill_number: loaded.bill_number,
      bill_date: loaded.bill_date,
      notes: loaded.notes,
      round_off: plain(loaded.round_off) || "0",
    });
    setLines(loaded.lines.map(lineFromServer));
  }, [loaded]);

  if (!isNew && loading && !bill) return <Spinner />;
  if (!isNew && !loaded && loadError) return <Alert>{loadError}</Alert>;

  const doneBill = bill || loaded;
  if (done && doneBill) {
    return (
      <DonePanel
        title="Goods added to stock"
        detail={`Bill ${doneBill.bill_number} from ${doneBill.supplier_name} · ${plural(doneBill.lines.length, "item")} · ${money(doneBill.total)}`}
        note="Stock is updated. You can find this bill later in More › Purchase Bills."
      >
        <GoHomeButton />
        <Button className="h-14 text-lg" onClick={() => navigate("/purchases/new", { replace: true })}>
          <Plus size={20} /> Enter another bill
        </Button>
        <button type="button" onClick={() => setDone(false)} className="self-center p-2 font-semibold text-blue-800 hover:underline">
          See this bill
        </button>
      </DonePanel>
    );
  }

  const posted = bill?.status === "posted";
  const amounts = lines.map(lineAmounts);
  const taxableTotal = round2(amounts.reduce((sum, a) => sum + a.taxable, 0));
  const taxTotal = round2(amounts.reduce((sum, a) => sum + a.tax, 0));
  const total = round2(taxableTotal + taxTotal + Number(header.round_off || 0));
  const paperDiff = paperTotal === "" ? null : round2(Number(paperTotal) - total);
  const missingRates = lines.filter((line) => line.rate === "").length;

  const setH = (key) => (event) => setHeader({ ...header, [key]: event.target.value });
  const setLine = (key, field, value) => setLines(lines.map((line) => (line.key === key ? { ...line, [field]: value } : line)));

  function addItem(item, unitId) {
    const existing = lines.find((line) => line.item === item.id && line.unit === unitId);
    if (existing) {
      setLine(existing.key, "quantity", plain(Number(existing.quantity || 0) + 1));
      setNotice(`+1 ${item.name}`);
    } else {
      setLines([...lines, lineFromItem(item, unitId)]);
      setNotice(`Added ${item.name}`);
    }
  }

  function payload() {
    return {
      ...header,
      supplier: header.supplier || null,
      round_off: header.round_off || "0",
      lines: lines.map((line) => ({
        item: line.item,
        unit: line.unit,
        quantity: line.quantity,
        rate: line.rate === "" ? "0" : line.rate,
        discount_percent: line.discount_percent || "0",
        gst_rate: line.gst_rate,
      })),
    };
  }

  /** Save as draft. A new bill moves to its own URL unless we're about to post it. */
  async function save({ stay = false } = {}) {
    setError("");
    setBusy(true);
    try {
      const response = isNew
        ? await api.post("/purchases/bills", payload())
        : await api.patch(`/purchases/bills/${id}`, payload());
      const saved = "Saved. Stock doesn't change until you press “Add to stock”.";
      if (isNew && !stay) {
        navigate(`/purchases/${response.data.id}`, { replace: true, state: { notice: saved } });
      } else {
        setBill(response.data);
        setLines(response.data.lines.map(lineFromServer));
        setNotice(saved);
      }
      return response.data;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function post() {
    const saved = await save({ stay: true });
    if (!saved) {
      setModal(null);
      return;
    }
    setBusy(true);
    try {
      const response = await api.post(`/purchases/bills/${saved.id}/post`);
      if (isNew) {
        navigate(`/purchases/${saved.id}`, { replace: true, state: { added: true } });
        return;
      }
      setBill(response.data);
      setModal(null);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
      setModal(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this bill? It was not added to stock.")) return;
    try {
      await api.delete(`/purchases/bills/${id}`);
      back.go();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function attach(event) {
    const file = event.target.files?.[0];
    if (!file || !bill) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await api.post(`/purchases/bills/${bill.id}/attachment`, form);
      setBill({ ...bill, attachment: response.data.attachment });
      setNotice("Bill photo attached.");
    } catch (err) {
      setError(errorMessage(err));
    }
    event.target.value = "";
  }

  const supplierName = suppliers?.find((s) => String(s.id) === header.supplier)?.name;

  return (
    <>
      <div className="mb-1">
        <BackLink to="/purchases">Purchase Bills</BackLink>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">
          {isNew ? "Goods Arrived" : `Bill ${bill?.bill_number || ""}`}{" "}
          {bill && <Badge color={posted ? "green" : "amber"}>{posted ? "Added to stock" : "Not added yet"}</Badge>}
        </h1>
        {posted && (
          <p className="text-gray-600">
            Added to stock {date(bill.posted_at)} by {bill.posted_by}
          </p>
        )}
      </div>

      <Alert onClose={() => setError("")}>{error}</Alert>
      <Alert kind="success" onClose={() => setNotice("")}>
        {notice}
      </Alert>

      <Card className="p-5 mb-6">
        <div className="grid md:grid-cols-4 gap-4">
          <Field label="Distributor *" className="md:col-span-2">
            {posted ? (
              <p className="py-2 font-semibold">{bill.supplier_name}</p>
            ) : (
              <div className="flex gap-2">
                <Select value={header.supplier} onChange={setH("supplier")}>
                  <option value="">Choose distributor…</option>
                  {(suppliers || []).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
                <Button onClick={() => setModal("supplier")} title="Add distributor" aria-label="Add distributor">
                  <Plus size={18} />
                </Button>
              </div>
            )}
          </Field>
          <Field label="Bill number *">
            <Input value={header.bill_number} onChange={setH("bill_number")} disabled={posted} />
          </Field>
          <Field label="Bill date *">
            <Input type="date" value={header.bill_date} onChange={setH("bill_date")} disabled={posted} max={today()} />
          </Field>
          <Field label="Notes" className="md:col-span-3">
            <Input value={header.notes} onChange={setH("notes")} disabled={posted} />
          </Field>
          <Field label="Photo / PDF of bill">
            {bill?.attachment ? (
              <a href={bill.attachment} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 py-2 text-blue-800 hover:underline">
                <Paperclip size={16} /> View attached bill
              </a>
            ) : bill ? (
              <input type="file" accept="image/*,application/pdf" onChange={attach} className="py-2 text-sm" />
            ) : (
              <p className="py-2 text-sm text-gray-500">Save the bill first</p>
            )}
          </Field>
        </div>
      </Card>

      {posted ? (
        <PostedBill bill={bill} />
      ) : (
        <Card className="p-5 mb-4">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="flex-1 min-w-[280px]">
              <ItemSearch onSelect={addItem} autoFocus={!isNew} />
            </div>
            <Button onClick={() => setModal("item")}>
              <Plus size={18} /> New item
            </Button>
          </div>
          {lines.length === 0 ? (
            <p className="text-gray-500 py-6 text-center">Scan or search the items on the bill to add them.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs uppercase text-gray-500">
                    <th className="px-1 pb-2">Item</th>
                    <th className="px-1 pb-2 w-24 text-right">Qty</th>
                    <th className="px-1 pb-2 w-36">Unit</th>
                    <th className="px-1 pb-2 w-28 text-right">Rate (before GST)</th>
                    <th className="px-1 pb-2 w-20 text-right">Disc %</th>
                    <th className="px-1 pb-2 w-24">GST %</th>
                    <th className="px-1 pb-2 w-28 text-right">Taxable</th>
                    <th className="px-1 pb-2 w-24 text-right">GST</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.key} className="border-t">
                      <td className="px-1 py-2">
                        <div className="font-semibold">{line.item_name}</div>
                        <div className="text-xs text-gray-500">#{line.item_code}</div>
                      </td>
                      <td className="px-1 py-2">
                        <input className={`${inputClass} px-2 py-1 text-right`} inputMode="decimal" value={line.quantity}
                          aria-label={`Quantity line ${index + 1}`} onChange={(e) => setLine(line.key, "quantity", e.target.value)} />
                      </td>
                      <td className="px-1 py-2">
                        <select className={`${inputClass} px-2 py-1`} value={line.unit} aria-label={`Unit line ${index + 1}`}
                          onChange={(e) => setLine(line.key, "unit", Number(e.target.value))}>
                          {line.units.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.is_base ? unit.name : `${unit.name} (${plain(unit.factor)} ${line.base_unit})`}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-2">
                        <input
                          className={`${inputClass} px-2 py-1 text-right ${line.rate === "" ? "border-amber-400 bg-amber-50" : ""}`}
                          inputMode="decimal" value={line.rate} placeholder="rate" aria-label={`Rate line ${index + 1}`}
                          onChange={(e) => setLine(line.key, "rate", e.target.value)} />
                      </td>
                      <td className="px-1 py-2">
                        <input className={`${inputClass} px-2 py-1 text-right`} inputMode="decimal" value={line.discount_percent}
                          aria-label={`Discount line ${index + 1}`} onChange={(e) => setLine(line.key, "discount_percent", e.target.value)} />
                      </td>
                      <td className="px-1 py-2">
                        <select className={`${inputClass} px-2 py-1`} value={line.gst_rate} aria-label={`GST line ${index + 1}`}
                          onChange={(e) => setLine(line.key, "gst_rate", e.target.value)}>
                          {GST_RATES.map((rate) => (
                            <option key={rate} value={rate}>
                              {rate}%
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-2 text-right">{money(amounts[index].taxable)}</td>
                      <td className="px-1 py-2 text-right text-gray-600">{money(amounts[index].tax)}</td>
                      <td className="px-1 py-2 text-right">
                        <button type="button" aria-label={`Remove line ${index + 1}`} onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
                          className="text-gray-400 hover:text-red-600">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div />
        <Card className="p-5">
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt>Taxable value</dt>
              <dd>{money(posted ? bill.taxable_total : taxableTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>GST</dt>
              <dd>{money(posted ? bill.tax_total : taxTotal)}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt>Round off</dt>
              <dd className="w-28">
                {posted ? money(bill.round_off) : <NumberInput className="text-right py-1" value={header.round_off} onChange={setH("round_off")} aria-label="Round off" />}
              </dd>
            </div>
            <div className="flex justify-between text-xl font-bold border-t pt-2">
              <dt>Bill total</dt>
              <dd>{money(posted ? bill.total : total)}</dd>
            </div>
            {!posted && (
              <div className="flex justify-between items-center pt-2">
                <dt className="text-sm text-gray-600">Total printed on paper bill</dt>
                <dd className="w-28">
                  <NumberInput className="text-right py-1" value={paperTotal} onChange={(e) => setPaperTotal(e.target.value)} placeholder="check" aria-label="Total printed on paper bill" />
                </dd>
              </div>
            )}
            {paperDiff !== null && !posted && (
              <p className={`text-sm font-semibold ${paperDiff === 0 ? "text-green-700" : "text-red-700"}`}>
                {paperDiff === 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 size={16} /> Matches the paper bill
                  </span>
                ) : (
                  `Differs from the paper bill by ${money(Math.abs(paperDiff))} — check rates and quantities`
                )}
              </p>
            )}
          </dl>
        </Card>
      </div>

      {!posted && (
        <div className="flex flex-wrap gap-3 mt-6">
          <Button onClick={() => save()} disabled={busy || !header.supplier || !header.bill_number.trim()}>
            Save, finish later
          </Button>
          <Button variant="success" onClick={() => setModal("post")} disabled={busy || !header.supplier || !header.bill_number.trim() || !lines.length}>
            Add to stock…
          </Button>
          {bill && (
            <Button variant="danger" onClick={remove}>
              Delete this bill
            </Button>
          )}
        </div>
      )}

      {modal === "supplier" && (
        <SupplierModal
          onClose={() => setModal(null)}
          onCreated={(supplier) => {
            reloadSuppliers();
            setHeader({ ...header, supplier: String(supplier.id) });
            setModal(null);
          }}
        />
      )}
      {modal === "item" && (
        <QuickItemModal
          onClose={() => setModal(null)}
          onCreated={(item) => {
            addItem(item, item.units.find((unit) => unit.is_base)?.id);
            setModal(null);
          }}
        />
      )}
      {modal === "post" && (
        <Modal title="Add these goods to stock?" onClose={() => setModal(null)}>
          <p className="mb-2">
            <b>{lines.length}</b> lines from <b>{supplierName}</b>, bill <b>{header.bill_number}</b>, total <b>{money(total)}</b>.
          </p>
          {missingRates > 0 && (
            <Alert kind="warning">{missingRates} line(s) have no rate and will be added as free goods (₹0).</Alert>
          )}
          {paperDiff !== null && paperDiff !== 0 && (
            <Alert kind="warning">The total differs from the paper bill by {money(Math.abs(paperDiff))}.</Alert>
          )}
          <p className="text-gray-600 mb-4">The goods are added to stock and average costs updated. After this the bill can't be changed.</p>
          <div className="flex gap-3">
            <Button variant="success" onClick={post} disabled={busy}>
              {busy ? "Adding…" : "Yes, add to stock"}
            </Button>
            <Button onClick={() => setModal(null)}>Back</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
