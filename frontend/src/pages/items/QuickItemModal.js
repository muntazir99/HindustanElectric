import { useState } from "react";
import api from "../../api.js";
import { useFetch } from "../../hooks/useFetch.js";
import { errorMessage } from "../../lib/errors.js";
import { BASE_UNITS, GST_RATES } from "../../lib/format.js";
import { Alert, Button, Field, Input, Modal, NumberInput, Select } from "../../ui/index.js";

/** Add one item without leaving the current screen (e.g. while entering a bill). */
export default function QuickItemModal({ onClose, onCreated }) {
  const { data: brands } = useFetch("/catalog/brands");
  const [form, setForm] = useState({
    brand: "",
    name: "",
    variant: "",
    base_unit: "pc",
    hsn_code: "",
    gst_rate: "18",
    selling_price: "",
    barcode: "",
    pack_name: "",
    pack_factor: "",
    pack_barcode: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function save() {
    setSaving(true);
    setError("");
    const hasPack = form.pack_name.trim() && form.pack_factor;
    const variants = {
      base_unit: form.base_unit,
      pack: hasPack ? { name: form.pack_name.trim(), factor: form.pack_factor } : null,
      variants: [
        {
          variant: form.variant.trim(),
          selling_price: form.selling_price || null,
          barcode: form.barcode.trim(),
          pack_barcode: hasPack ? form.pack_barcode.trim() : "",
        },
      ],
    };
    try {
      let item;
      try {
        const response = await api.post("/catalog/products", {
          name: form.name,
          brand: form.brand,
          hsn_code: form.hsn_code,
          gst_rate: form.gst_rate,
          ...variants,
        });
        item = response.data.items[0];
      } catch (err) {
        // The product exists already: add this as a new variant of it.
        const productId = err.response?.data?.product_id;
        if (!productId) throw err;
        item = (await api.post(`/catalog/products/${productId}/variants`, variants)).data[0];
      }
      onCreated(item);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal title="New item" onClose={onClose} wide>
      <Alert>{error}</Alert>
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Brand">
          <Input list="quick-brands" value={form.brand} onChange={set("brand")} autoFocus />
          <datalist id="quick-brands">
            {(brands || []).map((brand) => (
              <option key={brand.id} value={brand.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Product name *">
          <Input value={form.name} onChange={set("name")} />
        </Field>
        <Field label="Variant (size / colour)">
          <Input value={form.variant} onChange={set("variant")} />
        </Field>
        <Field label="Sold in">
          <Select value={form.base_unit} onChange={set("base_unit")}>
            {BASE_UNITS.map(([value, label]) => (
              <option key={value} value={value}>
                {label} ({value})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="HSN">
          <Input value={form.hsn_code} onChange={set("hsn_code")} inputMode="numeric" />
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
        <Field label={`Selling price / ${form.base_unit}`} hint="GST included">
          <NumberInput value={form.selling_price} onChange={set("selling_price")} />
        </Field>
        <Field label="Barcode (single unit)">
          <Input value={form.barcode} onChange={set("barcode")} />
        </Field>
        <div />
        <Field label="Pack name" hint="Optional, e.g. coil or box">
          <Input value={form.pack_name} onChange={set("pack_name")} />
        </Field>
        <Field label={`${form.base_unit} per pack`}>
          <NumberInput value={form.pack_factor} onChange={set("pack_factor")} />
        </Field>
        <Field label="Pack barcode">
          <Input value={form.pack_barcode} onChange={set("pack_barcode")} />
        </Field>
      </div>
      <div className="flex gap-3 mt-6">
        <Button variant="primary" onClick={save} disabled={saving || !form.name.trim()}>
          {saving ? "Saving…" : "Save item"}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
