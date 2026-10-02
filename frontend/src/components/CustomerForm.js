import { useState } from "react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { A } from "../lib/access.js";
import { errorMessage } from "../lib/errors.js";
import { plain } from "../lib/format.js";
import { Alert, Button, Field, Input, Modal, NumberInput, Select } from "../ui/index.js";

export const CUSTOMER_KINDS = [
  ["retail", "Retail"],
  ["electrician", "Electrician"],
  ["contractor", "Contractor"],
  ["business", "Business"],
];

/** Add a customer, or edit one (pass `customer`). Credit limit, discount and switching off need "Udhaar control". */
export default function CustomerForm({ customer, initialName = "", onClose, onSaved }) {
  const { can } = useAuth();
  const control = can(A.KHATA_CONTROL);
  const digits = /^\d+$/.test(initialName.replace(/\s/g, ""));
  const [form, setForm] = useState({
    name: customer?.name ?? (digits ? "" : initialName),
    phone: customer?.phone ?? (digits ? initialName : ""),
    gstin: customer?.gstin ?? "",
    address: customer?.address ?? "",
    kind: customer?.kind ?? "retail",
    notes: customer?.notes ?? "",
    credit_limit: customer?.credit_limit != null ? plain(customer.credit_limit) : "",
    default_discount_percent: customer ? plain(customer.default_discount_percent) : "",
    is_active: customer?.is_active ?? true,
  });
  const [error, setError] = useState("");
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function save() {
    const body = { name: form.name, phone: form.phone, gstin: form.gstin, address: form.address, kind: form.kind, notes: form.notes };
    if (control) {
      body.credit_limit = form.credit_limit === "" ? null : form.credit_limit;
      body.default_discount_percent = form.default_discount_percent || "0";
      if (customer) body.is_active = form.is_active;
    }
    try {
      const response = customer ? await api.patch(`/sales/customers/${customer.id}`, body) : await api.post("/sales/customers", body);
      onSaved(response.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal title={customer ? "Edit customer" : "New customer"} onClose={onClose}>
      <Alert>{error}</Alert>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name *" className="col-span-2">
          <Input value={form.name} onChange={set("name")} autoFocus />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set("phone")} inputMode="tel" />
        </Field>
        <Field label="Type">
          <Select value={form.kind} onChange={set("kind")}>
            {CUSTOMER_KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="GSTIN" className="col-span-2" hint="Only for registered businesses">
          <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Address" className="col-span-2">
          <Input value={form.address} onChange={set("address")} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <Input value={form.notes} onChange={set("notes")} />
        </Field>
        {control ? (
          <>
            <Field label="Credit limit (₹)" hint="Blank = no limit, 0 = no credit">
              <NumberInput value={form.credit_limit} onChange={set("credit_limit")} />
            </Field>
            <Field label="Discount on every bill (%)" hint="e.g. electricians' discount">
              <NumberInput value={form.default_discount_percent} onChange={set("default_discount_percent")} />
            </Field>
            {customer && (
              <label className="col-span-2 flex items-center gap-2">
                <input type="checkbox" className="w-5 h-5" checked={!form.is_active} onChange={(e) => setForm({ ...form, is_active: !e.target.checked })} />
                Inactive (hide from lists; khata history is kept)
              </label>
            )}
          </>
        ) : (
          <p className="col-span-2 text-sm text-gray-500">The owner sets credit limits and discounts.</p>
        )}
      </div>
      <div className="flex gap-3 mt-6">
        <Button variant="primary" onClick={save} disabled={!form.name.trim()}>
          Save customer
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
