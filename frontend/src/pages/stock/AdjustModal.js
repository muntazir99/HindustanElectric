import { useState } from "react";
import api from "../../api.js";
import { errorMessage } from "../../lib/errors.js";
import { plain } from "../../lib/format.js";
import { Alert, Button, Field, Input, Modal, NumberInput, Select } from "../../ui/index.js";

export const REASONS = [
  ["damaged", "Damaged / broken"],
  ["lost", "Lost / missing"],
  ["sample", "Given as sample"],
  ["own_use", "Used in shop"],
  ["correction", "Entry mistake correction"],
  ["other", "Other"],
];

/** Owner-only stock correction for one item. */
export default function AdjustModal({ item, onClose, onDone }) {
  const baseUnit = item.units.find((unit) => unit.is_base);
  const [direction, setDirection] = useState("remove");
  const [quantity, setQuantity] = useState("");
  const [unitId, setUnitId] = useState(String(baseUnit?.id ?? ""));
  const [reason, setReason] = useState("damaged");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const unit = item.units.find((u) => String(u.id) === unitId) || baseUnit;
  const amount = Number(quantity) || 0;
  const change = amount * Number(unit?.factor || 1) * (direction === "remove" ? -1 : 1);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api.post("/stock/adjustments", {
        item: item.id,
        unit: unit.id,
        quantity: direction === "remove" ? `-${quantity}` : quantity,
        reason,
        note,
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal title={`Adjust stock — ${item.name}`} onClose={onClose}>
      <Alert>{error}</Alert>
      <p className="text-sm text-gray-600 mb-4">
        Now: <b>{item.stock_display}</b>. Use this for breakage, loss or fixing a mistake. Prefer a stock count when
        you've checked the shelf.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex gap-2" role="radiogroup" aria-label="Add or remove">
          {[
            ["remove", "Remove from stock"],
            ["add", "Add to stock"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={direction === value}
              onClick={() => setDirection(value)}
              className={`flex-1 py-2 rounded-lg border font-semibold ${
                direction === value
                  ? value === "remove"
                    ? "bg-red-50 border-red-400 text-red-800"
                    : "bg-green-50 border-green-500 text-green-800"
                  : "bg-white border-gray-300 text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Field label="Quantity">
          <NumberInput value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />
        </Field>
        <Field label="Unit">
          <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            {item.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.is_base ? u.name : `${u.name} (${plain(u.factor)} ${item.base_unit})`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reason" className="col-span-2">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note" className="col-span-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened?" />
        </Field>
      </div>
      {amount > 0 && (
        <p className="mt-4 text-sm">
          Stock will change by{" "}
          <b className={change < 0 ? "text-red-700" : "text-green-700"}>
            {change > 0 ? "+" : ""}
            {plain(change)} {item.base_unit}
          </b>
          .
        </p>
      )}
      <div className="flex gap-3 mt-6">
        <Button variant="primary" onClick={save} disabled={saving || !(amount > 0)}>
          {saving ? "Saving…" : "Save adjustment"}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
