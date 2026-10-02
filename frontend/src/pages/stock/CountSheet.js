import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import api from "../../api.js";
import ItemSearch from "../../components/ItemSearch.js";
import { useAuth } from "../../context/AuthContext.js";
import { A } from "../../lib/access.js";
import { useFetch } from "../../hooks/useFetch.js";
import { errorMessage } from "../../lib/errors.js";
import { dateTime, plain, plural, signed } from "../../lib/format.js";
import { Alert, BackLink, Badge, Button, Card, Empty, Input, Modal, NumberInput, Spinner, Table, td, th } from "../../ui/index.js";
import { COUNT_STATUS_COLOR, COUNT_STATUS_LABEL } from "./CountList.js";

function QuantityCell({ line, onSet, disabled }) {
  const [value, setValue] = useState(plain(line.counted_qty));
  const changed = value !== plain(line.counted_qty);
  return (
    <div className="flex items-center gap-2 justify-end">
      <NumberInput
        className="w-24 text-right py-1"
        value={value}
        disabled={disabled}
        aria-label={`Counted ${line.item_name}`}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && changed && onSet(value)}
        onBlur={() => changed && value !== "" && onSet(value)}
      />
      <span className="text-gray-500 w-8">{line.base_unit}</span>
    </div>
  );
}

function RackHelper({ countedIds, onCount, disabled }) {
  const [rack, setRack] = useState("");
  const [shown, setShown] = useState("");
  const { data } = useFetch(shown ? `/catalog/items?rack=${encodeURIComponent(shown)}&page_size=200` : null);
  const remaining = (data?.results || []).filter((item) => !countedIds.has(item.id));

  return (
    <Card className="p-5 mb-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="font-semibold mb-1">Items without a barcode?</p>
          <p className="text-sm text-gray-600 mb-2">Show everything kept on a rack and type what you find.</p>
          <Input value={rack} onChange={(e) => setRack(e.target.value)} placeholder="Rack, e.g. A3" onKeyDown={(e) => e.key === "Enter" && setShown(rack.trim())} />
        </div>
        <Button onClick={() => setShown(rack.trim())} disabled={!rack.trim()}>
          Show rack
        </Button>
      </div>
      {shown && data && (
        <div className="mt-4">
          {remaining.length === 0 ? (
            <p className="text-gray-600">All items on rack {shown} are in this count.</p>
          ) : (
            <ul className="divide-y border rounded-lg">
              {remaining.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>
                    {item.name} <span className="text-gray-500 text-sm">#{item.code}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <NumberInput
                      className="w-24 text-right py-1"
                      placeholder="0"
                      disabled={disabled}
                      aria-label={`Counted ${item.name}`}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.value !== "" && onCount(item.id, e.currentTarget.value)}
                      onBlur={(e) => e.currentTarget.value !== "" && onCount(item.id, e.currentTarget.value)}
                    />
                    <span className="text-gray-500 w-8">{item.base_unit}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

export default function CountSheet() {
  const { id } = useParams();
  const { can } = useAuth();
  const canSave = can(A.FIX_STOCK); // sees differences and saves the count to stock
  const { data: count, error: loadError, loading, setData } = useFetch(`/stock/counts/${id}`);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading && !count) return <Spinner />;
  if (!count) return <Alert>{loadError || "Count not found."}</Alert>;

  const open = count.status === "open";
  const countedIds = new Set(count.lines.map((line) => line.item));
  const withDifference = count.lines.filter((line) => Number(line.difference) !== 0);

  function upsertLine(line) {
    setData((current) => ({
      ...current,
      lines: [line, ...current.lines.filter((existing) => existing.id !== line.id)],
    }));
  }

  async function record(body, label) {
    setError("");
    try {
      const response = await api.post(`/stock/counts/${id}/lines`, body);
      upsertLine(response.data);
      setFlash(`${label} · ${response.data.item_name} — counted ${response.data.counted_display}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function onScan(item, unitId) {
    const unit = item.units.find((u) => u.id === unitId);
    record({ item: item.id, unit: unitId, quantity: "1", mode: "add" }, `+1 ${unit?.name || item.base_unit}`);
  }

  async function removeLine(line) {
    setError("");
    try {
      await api.delete(`/stock/counts/${id}/lines/${line.id}`);
      setData((current) => ({ ...current, lines: current.lines.filter((l) => l.id !== line.id) }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function finish(action) {
    setBusy(true);
    setError("");
    try {
      setData((await api.post(`/stock/counts/${id}/${action}`)).data);
      setConfirm(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-1">
        <BackLink to="/counts">Check Stock</BackLink>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Checking: {count.title}</h1>
          <p className="text-gray-600 mt-1 flex items-center gap-2">
            <Badge color={COUNT_STATUS_COLOR[count.status]}>{COUNT_STATUS_LABEL[count.status] || count.status_display}</Badge>
            Started {dateTime(count.created_at)} by {count.created_by} · {plural(count.lines.length, "item")}
          </p>
        </div>
        {canSave && open && (
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => window.confirm("Cancel this count? Nothing will change in stock.") && finish("cancel")}>
              Cancel this count
            </Button>
            <Button variant="success" onClick={() => setConfirm(true)} disabled={!count.lines.length}>
              Check &amp; save to stock
            </Button>
          </div>
        )}
      </div>

      {open && !canSave && (
        <Alert kind="info">Count what you see on the shelf. The owner will check it and save it to stock.</Alert>
      )}
      <Alert onClose={() => setError("")}>{error}</Alert>

      {open && (
        <Card className="p-5 mb-6">
          <p className="font-semibold mb-2">Scan each piece or pack — every scan adds one</p>
          <ItemSearch onSelect={onScan} />
          {flash && <p className="mt-3 text-green-800 font-semibold" role="status">{flash}</p>}
        </Card>
      )}
      {open && <RackHelper countedIds={countedIds} disabled={!open} onCount={(itemId, qty) => record({ item: itemId, quantity: qty, mode: "set" }, "Set")} />}

      <Card>
        {count.lines.length === 0 ? (
          <Empty>Nothing counted yet.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Item</th>
                <th className={th}>Rack</th>
                <th className={`${th} text-right`}>Counted</th>
                {canSave && <th className={`${th} text-right`}>System said</th>}
                {canSave && <th className={`${th} text-right`}>Difference</th>}
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {count.lines.map((line) => (
                <tr key={line.id}>
                  <td className={td}>
                    <Link to={`/items/${line.item}`} className="font-semibold hover:underline">
                      {line.item_name}
                    </Link>
                    <div className="text-sm text-gray-500">
                      #{line.item_code} · {line.counted_display} · by {line.counted_by}
                    </div>
                  </td>
                  <td className={td}>{line.rack || "—"}</td>
                  <td className={td}>
                    <QuantityCell
                      key={line.counted_qty}
                      line={line}
                      disabled={!open}
                      onSet={(qty) => record({ item: line.item, quantity: qty, mode: "set" }, "Set")}
                    />
                  </td>
                  {canSave && <td className={`${td} text-right`}>{plain(line.system_qty)}</td>}
                  {canSave && (
                    <td
                      className={`${td} text-right font-bold ${
                        Number(line.difference) < 0 ? "text-red-700" : Number(line.difference) > 0 ? "text-green-700" : "text-gray-400"
                      }`}
                    >
                      {Number(line.difference) === 0 ? "✓" : signed(line.difference)}
                    </td>
                  )}
                  <td className={`${td} text-right`}>
                    {open && (
                      <button type="button" aria-label={`Remove ${line.item_name}`} onClick={() => removeLine(line)} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {confirm && (
        <Modal title="Save this count to stock?" onClose={() => setConfirm(false)}>
          <p className="mb-2">
            <b>{plural(count.lines.length, "item")}</b> counted, <b>{withDifference.length}</b> with a difference.
          </p>
          <p className="text-gray-600 mb-4">
            Stock for these items will be set to what was counted (allowing for anything bought or sold since). They'll
            be marked as counted. This can't be undone, but a later count or adjustment can correct it.
          </p>
          <div className="flex gap-3">
            <Button variant="success" onClick={() => finish("post")} disabled={busy}>
              {busy ? "Saving…" : "Yes, save to stock"}
            </Button>
            <Button onClick={() => setConfirm(false)}>Back</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
