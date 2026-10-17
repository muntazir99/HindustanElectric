import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, ShoppingCart } from "lucide-react";
import api from "../../api.js";
import { useFetch } from "../../hooks/useFetch.js";
import { date, money, plain } from "../../lib/format.js";
import { errorMessage } from "../../lib/errors.js";
import { Alert, Button, Empty, PageHeader, Section, Select, Spinner, inputClass } from "../../ui/index.js";

/** One distributor's part of the list: tick, change quantities, make the order. */
function Group({ group, suppliers }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState(() => group.items.map((item) => ({ ...item, picked: Number(item.quantity) > 0 })));
  const [supplier, setSupplier] = useState(group.supplier ? String(group.supplier.id) : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const picked = rows.filter((row) => row.picked && Number(row.quantity) > 0);
  const set = (id, changes) => setRows(rows.map((row) => (row.id === id ? { ...row, ...changes } : row)));

  async function makeOrder() {
    setError("");
    setBusy(true);
    try {
      const lines = picked.map((row) => ({ item: row.id, unit: row.unit, quantity: row.quantity }));
      const response = await api.post("/purchases/orders", { supplier, lines });
      navigate(`/orders/${response.data.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Section title={group.supplier ? group.supplier.name : "No distributor yet"} className="mb-5">
      {!group.supplier && (
        <div className="px-4 pt-3 max-w-sm">
          <Select value={supplier} onChange={(e) => setSupplier(e.target.value)} aria-label="Distributor for these items">
            <option value="">Order these from…</option>
            {(suppliers || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {rows.map((row) => (
          <label key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 cursor-pointer">
            <input type="checkbox" className="w-5 h-5" checked={row.picked} onChange={(e) => set(row.id, { picked: e.target.checked })} aria-label={`Order ${row.name}`} />
            <div className="flex-1 min-w-[200px]">
              <p className="font-semibold">{row.name}</p>
              <p className="text-sm text-gray-600">
                Stock <b className="text-red-700">{row.stock} {row.base_unit}</b> · minimum {row.min_stock} {row.base_unit}
                {Number(row.on_order) > 0 && ` · ${row.on_order} ${row.base_unit} already on order`}
              </p>
              {row.last && (
                <p className="text-sm text-gray-500">
                  Last bought {date(row.last.date)} at {money(row.last.rate)}/{row.last.unit_name} before GST
                </p>
              )}
            </div>
            <input className={`${inputClass} w-24 px-2 py-1 text-right`} inputMode="decimal" value={row.quantity}
              aria-label={`Quantity of ${row.name}`} onChange={(e) => set(row.id, { quantity: e.target.value, picked: true })} />
            <select className={`${inputClass} w-40 px-2 py-1`} value={row.unit} aria-label={`Unit of ${row.name}`}
              onChange={(e) => set(row.id, { unit: Number(e.target.value) })}>
              {row.units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.is_base ? unit.name : `${unit.name} (${plain(unit.factor)} ${row.base_unit})`}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="px-4 py-3 bg-[#F8FAFB] border-t border-gray-100 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={makeOrder} disabled={busy || !supplier || picked.length === 0}>
          <ShoppingCart size={18} /> Make order{picked.length ? ` (${picked.length})` : ""}
        </Button>
        {error && <span className="text-red-700">{error}</span>}
      </div>
    </Section>
  );
}

/** Reorder list (plan §18.1): what's running low, by the distributor it was last bought from. */
export default function ReorderList() {
  const { data, error, loading } = useFetch("/purchases/reorder");
  const { data: suppliers } = useFetch("/purchases/suppliers");

  return (
    <>
      <PageHeader title="Reorder list" back={["/more", "All options"]} subtitle="Items at or below their minimum stock, with how many to order.">
        <Button to="/orders">
          <ClipboardList size={18} /> Orders
        </Button>
      </PageHeader>
      <Alert>{error}</Alert>
      {loading && !data ? (
        <Spinner />
      ) : !data?.groups.length ? (
        <Section>
          <Empty>Nothing is running low. Items show here once they're counted and have a minimum stock set.</Empty>
        </Section>
      ) : (
        <>
          <Alert kind="info">
            Suggested: enough to reach twice the minimum, less what's already on order, in the pack it was last bought in. Change any
            quantity, untick what you don't want, then make the order.
          </Alert>
          {data.groups.map((group) => (
            <Group key={group.supplier?.id ?? "none"} group={group} suppliers={suppliers} />
          ))}
        </>
      )}
    </>
  );
}
