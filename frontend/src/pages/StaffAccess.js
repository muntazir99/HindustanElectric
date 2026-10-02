import { useState } from "react";
import { KeyRound, Plus, Power } from "lucide-react";
import api from "../api.js";
import { useFetch } from "../hooks/useFetch.js";
import { errorMessage } from "../lib/errors.js";
import { dateTime } from "../lib/format.js";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Spinner } from "../ui/index.js";

/** Groups of switches in the order the server lists them. */
function grouped(switches) {
  const groups = [];
  switches.forEach((item) => {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  });
  return groups;
}

/** A whole row you can press: the job, what it allows, and an on/off switch. */
function Switch({ item, on, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 disabled:opacity-60"
    >
      <span className="flex-1 min-w-0">
        <span className="block font-semibold">{item.label}</span>
        <span className="block text-sm text-gray-600">{item.help}</span>
      </span>
      <span className={`shrink-0 relative w-14 h-8 rounded-full transition-colors ${on ? "bg-green-700" : "bg-gray-300"}`}>
        <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} />
      </span>
      <span className={`w-8 text-sm font-semibold ${on ? "text-green-800" : "text-gray-500"}`}>{on ? "On" : "Off"}</span>
    </button>
  );
}

function SwitchBoard({ definitions, value, onChange, disabled }) {
  const set = (code, on) => onChange(on ? [...value, code] : value.filter((c) => c !== code));
  return (
    <div className="grid lg:grid-cols-3 gap-x-6 gap-y-4">
      {grouped(definitions.switches).map((group) => (
        <div key={group.name}>
          <p className="px-3 mb-1 text-sm font-bold text-gray-500">{group.name}</p>
          {group.items.map((item) => (
            <Switch key={item.code} item={item} on={value.includes(item.code)} onChange={(on) => set(item.code, on)} disabled={disabled} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Presets({ definitions, onPick, disabled }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-gray-600">Start from:</span>
      {Object.entries(definitions.presets).map(([name, codes]) => (
        <Button key={name} onClick={() => onPick(codes)} disabled={disabled} className="min-h-[40px] py-1">
          {name}
        </Button>
      ))}
      <Button onClick={() => onPick([])} disabled={disabled} className="min-h-[40px] py-1">
        All off
      </Button>
    </div>
  );
}

function PersonCard({ person, definitions, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const owner = person.role === "owner";

  async function save(changes) {
    setBusy(true);
    setError("");
    try {
      onSaved((await api.patch(`/auth/staff/${person.id}`, changes)).data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={`p-5 md:p-6 ${person.is_active ? "" : "bg-gray-50"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold flex flex-wrap items-center gap-2">
            {person.name || person.username}
            {owner && <Badge color="blue">Owner</Badge>}
            {!person.is_active && <Badge color="red">Login switched off</Badge>}
          </h2>
          <p className="text-gray-600">
            Username <b>{person.username}</b>
            {person.last_login ? ` · last logged in ${dateTime(person.last_login)}` : " · hasn't logged in yet"}
          </p>
        </div>
        {!owner && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setPasswordOpen(true)}>
              <KeyRound size={18} /> New password
            </Button>
            <Button variant={person.is_active ? "danger" : "secondary"} onClick={() => save({ is_active: !person.is_active })} disabled={busy}>
              <Power size={18} /> {person.is_active ? "Switch login off" : "Switch login on"}
            </Button>
          </div>
        )}
      </div>
      <Alert onClose={() => setError("")}>{error}</Alert>
      {owner ? (
        <p className="text-gray-700">Can do everything, including this page.</p>
      ) : (
        <>
          <div className="mb-4">
            <Presets definitions={definitions} onPick={(codes) => save({ access: codes })} disabled={busy || !person.is_active} />
          </div>
          <SwitchBoard
            definitions={definitions}
            value={person.access}
            onChange={(codes) => save({ access: codes })}
            disabled={busy || !person.is_active}
          />
        </>
      )}
      {passwordOpen && <PasswordModal person={person} onClose={() => setPasswordOpen(false)} />}
    </Card>
  );
}

function PasswordModal({ person, onClose }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function save() {
    setError("");
    try {
      await api.post(`/auth/staff/${person.id}/password`, { password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal title={`New password for ${person.name || person.username}`} onClose={onClose}>
      {done ? (
        <>
          <Alert kind="success">Saved. Tell {person.name || person.username} the new password; it works straight away.</Alert>
          <Button onClick={onClose}>Close</Button>
        </>
      ) : (
        <>
          <Alert>{error}</Alert>
          <Field label="New password" hint="At least 8 characters; not only numbers, and not a common word.">
            <Input value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="new-password" />
          </Field>
          <div className="flex gap-3 mt-5">
            <Button variant="primary" onClick={save} disabled={!password}>
              Save password
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function AddStaffModal({ definitions, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const [access, setAccess] = useState(definitions.new_staff);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function save() {
    setBusy(true);
    setError("");
    try {
      onSaved((await api.post("/auth/staff", { ...form, access })).data);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title="Add staff" onClose={onClose} wide>
      <Alert>{error}</Alert>
      <div className="grid md:grid-cols-3 gap-4 mb-5">
        <Field label="Name">
          <Input value={form.name} onChange={set("name")} placeholder="e.g. Raju" autoFocus />
        </Field>
        <Field label="Username" hint="What they type to log in">
          <Input value={form.username} onChange={set("username")} autoComplete="off" />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <Input value={form.password} onChange={set("password")} autoComplete="new-password" />
        </Field>
      </div>
      <p className="font-bold mb-2">What can they do?</p>
      <div className="mb-3">
        <Presets definitions={definitions} onPick={setAccess} />
      </div>
      <SwitchBoard definitions={definitions} value={access} onChange={setAccess} />
      <div className="flex gap-3 mt-6">
        <Button variant="success" onClick={save} disabled={busy || !form.username.trim() || !form.password}>
          {busy ? "Saving…" : "Add staff"}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

export default function StaffAccess() {
  const { data: people, error, loading, setData } = useFetch("/auth/staff");
  const { data: definitions, error: defError } = useFetch("/auth/access");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");

  const replace = (updated) => setData(people.map((p) => (p.id === updated.id ? updated : p)));

  return (
    <>
      <PageHeader
        title="Staff & Access"
        back={["/more", "All options"]}
        subtitle="Who can log in, and what each person can do. Changes save as you switch them and apply straight away."
      >
        <Button variant="primary" onClick={() => setAdding(true)} disabled={!definitions}>
          <Plus size={20} /> Add staff
        </Button>
      </PageHeader>
      <Alert>{error || defError}</Alert>
      <Alert kind="success" onClose={() => setNotice("")}>
        {notice}
      </Alert>
      {loading && !people ? (
        <Spinner />
      ) : (
        people &&
        definitions && (
          <div className="space-y-5">
            {people.map((person) => (
              <PersonCard key={person.id} person={person} definitions={definitions} onSaved={replace} />
            ))}
          </div>
        )
      )}
      {adding && (
        <AddStaffModal
          definitions={definitions}
          onClose={() => setAdding(false)}
          onSaved={(person) => {
            setAdding(false);
            setData([...people, person]);
            setNotice(`${person.name || person.username} can now log in with username “${person.username}”.`);
          }}
        />
      )}
    </>
  );
}
