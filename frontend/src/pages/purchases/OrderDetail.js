import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Ban, Printer, Send, Trash2 } from "lucide-react";
import api from "../../api.js";
import ItemSearch from "../../components/ItemSearch.js";
import WhatsAppButton from "../../components/WhatsAppButton.js";
import { useFetch } from "../../hooks/useFetch.js";
import { usePage } from "../../hooks/usePage.js";
import { errorMessage } from "../../lib/errors.js";
import { date, dateTime, plain } from "../../lib/format.js";
import { orderMessage } from "../../lib/whatsapp.js";
import { Alert, Badge, Button, Field, Input, Section, Select, Spinner, inputClass } from "../../ui/index.js";
import { ORDER_STATUS } from "./OrderList.js";

let nextKey = 1;

const editable = (line) => ({
  key: nextKey++,
  item: line.item,
  item_name: line.item_name,
  item_code: line.item_code,
  base_unit: line.base_unit,
  units: line.item_units,
  unit: line.unit,
  quantity: plain(line.quantity),
});

/** One order for a distributor (plan §18): items and quantities only. /orders/new makes one. */
export default function OrderDetail() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { data: loaded, error: loadError, setData } = useFetch(isNew ? null : `/purchases/orders/${id}`);
  const { data: suppliers } = useFetch("/purchases/suppliers");
  const { data: shop } = useFetch("/shop/settings");
  const [form, setForm] = useState({ supplier: "", note: "", lines: [] });
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loaded) setForm({ supplier: String(loaded.supplier), note: loaded.note, lines: loaded.lines.map(editable) });
  }, [loaded]);

  usePage(isNew ? "New order" : `Order ${loaded?.number || ""}`.trim(), ["/orders", "Orders"]);

  if (!isNew && !loaded) return loadError ? <Alert>{loadError}</Alert> : <Spinner />;
  const order = loaded;
  const draft = isNew || order.status === "draft";

  function change(next) {
    setForm({ ...form, ...next });
    setDirty(true);
  }
  const setLine = (key, field, value) => change({ lines: form.lines.map((line) => (line.key === key ? { ...line, [field]: value } : line)) });

  function addItem(item, unitId) {
    const existing = form.lines.find((line) => line.item === item.id && line.unit === unitId);
    if (existing) return setLine(existing.key, "quantity", plain(Number(existing.quantity || 0) + 1));
    const units = item.units.map(({ id: unit, name, factor, is_base }) => ({ id: unit, name, factor, is_base }));
    change({ lines: [...form.lines, editable({ item: item.id, item_name: item.name, item_code: item.code, base_unit: item.base_unit, item_units: units, unit: unitId, quantity: "1" })] });
  }

  async function run(request) {
    setError("");
    setBusy(true);
    try {
      return await request();
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const body = {
      supplier: form.supplier || null,
      note: form.note,
      lines: form.lines.map(({ item, unit, quantity }) => ({ item, unit, quantity })),
    };
    const response = await run(() => (isNew ? api.post("/purchases/orders", body) : api.patch(`/purchases/orders/${id}`, body)));
    if (!response) return;
    setDirty(false);
    if (isNew) navigate(`/orders/${response.data.id}`, { replace: true });
    else setData(response.data);
  }

  async function move(action, question) {
    if (question && !window.confirm(question)) return;
    const response = await run(() => api.post(`/purchases/orders/${id}/${action}`));
    if (response) setData(response.data);
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[28px] font-bold leading-tight flex flex-wrap items-center gap-3">
            {isNew ? "New order" : `Order ${order.number}`}
            {order && <Badge color={ORDER_STATUS[order.status]}>{order.status_display}</Badge>}
          </h1>
          {order && (
            <p className="text-gray-600 mt-1">
              {order.supplier_name} · {date(order.order_date)} by {order.created_by}
              {order.sent_at && ` · sent ${dateTime(order.sent_at)}`}
            </p>
          )}
        </div>
        {order && (
          <div className="flex flex-wrap gap-2">
            {!dirty && (
              <Button to={`/orders/${order.id}/print`}>
                <Printer size={18} /> Print
              </Button>
            )}
            {shop && !dirty && order.status !== "cancelled" && (
              <WhatsAppButton phone={order.supplier_phone} text={orderMessage(order, shop.data)} />
            )}
            {order.status === "draft" && (
              <Button variant="primary" onClick={() => move("send")} disabled={busy || dirty}>
                <Send size={18} /> Mark as sent
              </Button>
            )}
            {["draft", "sent"].includes(order.status) && (
              <Button variant="danger" onClick={() => move("cancel", `Cancel order ${order.number}?`)} disabled={busy}>
                <Ban size={18} /> Cancel order
              </Button>
            )}
          </div>
        )}
      </div>

      <Alert onClose={() => setError("")}>{error}</Alert>
      {order?.status === "draft" && !dirty && (
        <Alert kind="info">Send it by WhatsApp or print it, then press Mark as sent. Rates are never on the order.</Alert>
      )}
      {dirty && order && <Alert kind="warning">Save the changes before printing or sending.</Alert>}

      {draft && (
        <Section title="Distributor" className="mb-5" bodyClassName="p-4 grid md:grid-cols-3 gap-4">
          <Field label="Distributor *">
            <Select value={form.supplier} onChange={(e) => change({ supplier: e.target.value })}>
              <option value="">Choose distributor…</option>
              {(suppliers || []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note for the distributor" className="md:col-span-2">
            <Input value={form.note} maxLength={250} onChange={(e) => change({ note: e.target.value })} placeholder="e.g. Send by Saturday" />
          </Field>
        </Section>
      )}
      {!draft && order.note && <p className="mb-4 text-gray-700">Note: {order.note}</p>}

      <Section title={`Items${form.lines.length ? ` (${form.lines.length})` : ""}`} bodyClassName={draft ? "p-4" : ""}>
        {draft && (
          <div className="mb-4 max-w-xl">
            <ItemSearch onSelect={addItem} autoFocus={false} cameraKeepsOpen={false} />
          </div>
        )}
        {form.lines.length === 0 ? (
          <p className="text-gray-500 py-6 text-center">Scan or search the items to order.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-sm font-semibold text-gray-600 border-b border-line">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 w-28 text-right">Qty</th>
                  <th className="px-3 py-2 w-40">Unit</th>
                  {draft && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, index) => (
                  <tr key={line.key} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{line.item_name}</div>
                      <div className="text-xs text-gray-500">#{line.item_code}</div>
                    </td>
                    {draft ? (
                      <>
                        <td className="px-3 py-2">
                          <input className={`${inputClass} px-2 py-1 text-right`} inputMode="decimal" value={line.quantity}
                            aria-label={`Quantity line ${index + 1}`} onChange={(e) => setLine(line.key, "quantity", e.target.value)} />
                        </td>
                        <td className="px-3 py-2">
                          <select className={`${inputClass} px-2 py-1`} value={line.unit} aria-label={`Unit line ${index + 1}`}
                            onChange={(e) => setLine(line.key, "unit", Number(e.target.value))}>
                            {line.units.map((unit) => (
                              <option key={unit.id} value={unit.id}>
                                {unit.is_base ? unit.name : `${unit.name} (${plain(unit.factor)} ${line.base_unit})`}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-2 text-right">
                          <button type="button" aria-label={`Remove line ${index + 1}`} onClick={() => change({ lines: form.lines.filter((l) => l.key !== line.key) })}
                            className="p-2 text-gray-400 hover:text-red-600">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-right font-semibold">{line.quantity}</td>
                        <td className="px-3 py-2">{line.units.find((unit) => unit.id === line.unit)?.name}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {draft && (
        <div className="flex flex-wrap gap-3 mt-5">
          <Button variant="primary" onClick={save} disabled={busy || !form.supplier || !form.lines.length || (!isNew && !dirty)}>
            {isNew ? "Save order" : "Save changes"}
          </Button>
        </div>
      )}
    </>
  );
}
