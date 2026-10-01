import { useState } from "react";
import { Plus } from "lucide-react";
import api from "../api.js";
import { useFetch } from "../hooks/useFetch.js";
import { errorMessage } from "../lib/errors.js";
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Spinner, Table, td, th } from "../ui/index.js";

function SupplierForm({ supplier, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: supplier?.name || "",
    phone: supplier?.phone || "",
    gstin: supplier?.gstin || "",
    address: supplier?.address || "",
    is_active: supplier?.is_active ?? true,
  });
  const [error, setError] = useState("");
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function save() {
    try {
      if (supplier) await api.patch(`/purchases/suppliers/${supplier.id}`, form);
      else await api.post("/purchases/suppliers", form);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal title={supplier ? "Edit distributor" : "Add distributor"} onClose={onClose}>
      <Alert>{error}</Alert>
      <div className="grid gap-4">
        <Field label="Name *">
          <Input value={form.name} onChange={set("name")} autoFocus />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label="GSTIN">
          <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Address">
          <Input value={form.address} onChange={set("address")} />
        </Field>
        {supplier && (
          <label className="flex items-center gap-2">
            <input type="checkbox" className="w-5 h-5" checked={!form.is_active} onChange={(e) => setForm({ ...form, is_active: !e.target.checked })} />
            We don't buy from them any more (hide from lists)
          </label>
        )}
      </div>
      <div className="flex gap-3 mt-6">
        <Button variant="primary" onClick={save} disabled={!form.name.trim()}>
          Save
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

export default function Suppliers() {
  const [showInactive, setShowInactive] = useState(false);
  const { data, error, loading, reload } = useFetch(`/purchases/suppliers${showInactive ? "?include_inactive=1" : ""}`);
  const [editing, setEditing] = useState(null);

  return (
    <>
      <PageHeader title="Distributors" back={["/more", "All options"]} subtitle="Companies and dealers you buy from">
        <Button variant="primary" onClick={() => setEditing("new")}>
          <Plus size={18} /> Add distributor
        </Button>
      </PageHeader>
      <label className="flex items-center gap-2 mb-4 text-sm">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Also show ones we don't buy from any more
      </label>
      <Alert>{error}</Alert>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : !data?.length ? (
          <Empty>No distributors yet.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Phone</th>
                <th className={th}>GSTIN</th>
                <th className={th}>Address</th>
              </tr>
            </thead>
            <tbody>
              {data.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => setEditing(supplier)}>
                  <td className={`${td} font-semibold`}>
                    {supplier.name} {!supplier.is_active && <Badge>Former</Badge>}
                  </td>
                  <td className={td}>{supplier.phone || "—"}</td>
                  <td className={`${td} font-mono text-sm`}>{supplier.gstin || "—"}</td>
                  <td className={`${td} text-sm text-gray-600`}>{supplier.address || "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {editing && (
        <SupplierForm
          supplier={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}
