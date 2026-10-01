import { useState } from "react";
import api from "../../api.js";
import { errorMessage } from "../../lib/errors.js";
import { Alert, Button, Card, Field, Input, PageHeader, Select } from "../../ui/index.js";

export default function CreateUser() {
  const [form, setForm] = useState({ username: "", password: "", role: "staff" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function save() {
    setError("");
    setMessage("");
    try {
      const response = await api.post("/auth/create_user", form);
      setMessage(response.data.message);
      setForm({ username: "", password: "", role: "staff" });
    } catch (err) {
      setError(err.response?.data?.message || errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Add user" subtitle="Give a staff member their own login. Everything they do is recorded under their name." />
      <Card className="p-6 max-w-lg">
        <Alert>{error}</Alert>
        <Alert kind="success">{message}</Alert>
        <div className="grid gap-4">
          <Field label="Username">
            <Input value={form.username} onChange={set("username")} autoComplete="off" />
          </Field>
          <Field label="Password" hint="At least 8 characters; not only numbers; not a common password.">
            <Input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={set("role")}>
              <option value="staff">Staff — daily work: items, purchases, counting</option>
              <option value="owner">Owner — everything, including prices, adjustments and users</option>
            </Select>
          </Field>
        </div>
        <Button variant="primary" className="mt-6" onClick={save} disabled={!form.username.trim() || !form.password}>
          Create user
        </Button>
      </Card>
    </>
  );
}
