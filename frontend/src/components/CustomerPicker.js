import { useEffect, useRef, useState } from "react";
import { UserPlus, X } from "lucide-react";
import api from "../api.js";
import { errorMessage } from "../lib/errors.js";
import { money } from "../lib/format.js";
import { Alert, Button, Field, Input, Modal, Select, inputClass } from "../ui/index.js";

export const CUSTOMER_KINDS = [
  ["retail", "Retail"],
  ["electrician", "Electrician"],
  ["contractor", "Contractor"],
  ["business", "Business"],
];

function NewCustomerModal({ initialName, onClose, onCreated }) {
  const digits = /^\d+$/.test(initialName.replace(/\s/g, ""));
  const [form, setForm] = useState({
    name: digits ? "" : initialName,
    phone: digits ? initialName : "",
    gstin: "",
    address: "",
    kind: "retail",
  });
  const [error, setError] = useState("");
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function save() {
    try {
      onCreated((await api.post("/sales/customers", form)).data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal title="New customer" onClose={onClose}>
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
      </div>
      <p className="text-sm text-gray-500 mt-3">The owner can set a credit limit and discount later.</p>
      <div className="flex gap-3 mt-4">
        <Button variant="primary" onClick={save} disabled={!form.name.trim()}>
          Save customer
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

/** Pick a customer by name or phone, or add one. value is a customer object or null (walk-in). */
export default function CustomerPicker({ value, onChange, inputId = "customer-search" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (!text) {
      setResults([]);
      return undefined;
    }
    const request = ++latest.current;
    const timer = setTimeout(async () => {
      try {
        const response = await api.get("/sales/customers", { params: { search: text, page_size: 8 } });
        if (request === latest.current) {
          setResults(response.data.results);
          setOpen(true);
        }
      } catch {
        /* the box just stays empty */
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function choose(customer) {
    onChange(customer);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  if (value) {
    const owes = Number(value.balance) > 0;
    return (
      <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50">
        <div>
          <p className="font-bold">{value.name}</p>
          <p className="text-sm text-gray-600">
            {[value.phone, value.gstin].filter(Boolean).join(" · ") || "No phone"}
          </p>
          <p className={`text-sm ${owes ? "text-red-700 font-semibold" : "text-gray-600"}`}>
            Khata: {owes ? `owes ${money(value.balance)}` : "nothing due"}
            {value.credit_limit !== null && value.credit_limit !== undefined && ` · limit ${money(value.credit_limit)}`}
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} aria-label="Remove customer (walk-in)" className="text-gray-500 hover:text-red-600">
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        id={inputId}
        className={inputClass}
        placeholder="Walk-in · type name or phone for a customer"
        value={query}
        autoComplete="off"
        aria-label="Customer"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) {
            e.preventDefault();
            choose(results[0]);
          }
        }}
      />
      {open && query.trim() && (
        <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {results.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-blue-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(customer)}
              >
                <span className="font-semibold">{customer.name}</span>
                <span className="text-sm text-gray-500 ml-2">{customer.phone}</span>
                {Number(customer.balance) > 0 && <span className="text-sm text-red-700 ml-2">owes {money(customer.balance)}</span>}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-blue-800 font-semibold hover:bg-blue-50 flex items-center gap-2"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setAdding(true)}
            >
              <UserPlus size={16} /> Add “{query.trim()}” as a new customer
            </button>
          </li>
        </ul>
      )}
      {adding && (
        <NewCustomerModal
          initialName={query.trim()}
          onClose={() => setAdding(false)}
          onCreated={(customer) => {
            setAdding(false);
            choose(customer);
          }}
        />
      )}
    </div>
  );
}
