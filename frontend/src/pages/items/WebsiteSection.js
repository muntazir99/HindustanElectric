import { useEffect, useState } from "react";
import { Globe, ImagePlus, Trash2 } from "lucide-react";
import api from "../../api.js";
import { errorMessage } from "../../lib/errors.js";
import { shrink } from "../../lib/images.js";
import { Alert, Button, Field, Section, Select } from "../../ui/index.js";

const TRY_ON = [
  ["", "No try-on"],
  ["wall", "On a wall (switches, sockets, lights)"],
  ["ceiling", "On a ceiling (fans)"],
];
const NEW_IN_STORE = [
  ["auto", "For 30 days after a new lot arrives"],
  ["always", "Always"],
  ["never", "Never"],
];

/** One picture slot: preview (fetched with the login), choose a new one, remove. */
function Picture({ item, kind, label, hint, has, onChanged }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const url = `/catalog/items/${item.id}/web-image/${kind}`;

  useEffect(() => {
    if (!has) return setSrc("");
    let objectUrl = "";
    api.get(url, { responseType: "blob" }).then(
      (response) => setSrc((objectUrl = URL.createObjectURL(response.data))),
      () => setSrc(""),
    );
    return () => objectUrl && URL.revokeObjectURL(objectUrl);
  }, [url, has]);

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", await shrink(file, { keepsAlpha: kind === "tryon" }));
      onChanged((await api.post(url, form)).data);
    } catch (err) {
      setError(errorMessage(err, "That picture couldn't be used. Try a JPG or PNG."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError("");
    try {
      onChanged((await api.delete(url)).data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex-[1_1_240px] min-w-0">
      <p className="font-semibold">{label}</p>
      <p className="text-sm text-gray-500 mb-2">{hint}</p>
      <div className="h-40 rounded-lg border border-dashed border-gray-300 bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:16px_16px] flex items-center justify-center overflow-hidden">
        {src ? <img src={src} alt={`${label} of ${item.name}`} className="max-h-full max-w-full object-contain" /> : <span className="text-gray-500 text-sm">No picture yet</span>}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white font-semibold cursor-pointer hover:bg-gray-50">
          <ImagePlus size={18} /> {busy ? "Sending…" : has ? "Change" : "Choose picture"}
          <input type="file" accept="image/*" className="sr-only" onChange={choose} disabled={busy} />
        </label>
        {has && (
          <Button variant="danger" onClick={remove} aria-label={`Remove ${label.toLowerCase()}`}>
            <Trash2 size={18} />
          </Button>
        )}
      </div>
      <Alert onClose={() => setError("")}>{error}</Alert>
    </div>
  );
}

/** "On the website" (plan §21.4): the product's website settings and this variant's pictures. */
export default function WebsiteSection({ item, onChanged }) {
  const web = item.website;
  const [form, setForm] = useState({ on_website: web.on_website, web_description: web.description, tryon_surface: web.tryon_surface, web_new: web.web_new });
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const dirty =
    form.on_website !== web.on_website || form.web_description !== web.description || form.tryon_surface !== web.tryon_surface || form.web_new !== web.web_new;

  async function save() {
    setError("");
    setSaved("");
    try {
      await api.patch(`/catalog/products/${item.product}`, form);
      onChanged({ ...item, website: { ...web, ...form, description: form.web_description } });
      setSaved(form.on_website ? "Saved. It shows on the website." : "Saved. It's not on the website.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Section title="On the website" className="mb-5" bodyClassName="p-4 space-y-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" className="w-5 h-5 mt-0.5" checked={form.on_website} onChange={(e) => setForm({ ...form, on_website: e.target.checked })} />
        <span>
          <span className="font-semibold flex items-center gap-2">
            <Globe size={18} /> Show this product on the website
          </span>
          <span className="block text-sm text-gray-500">
            With all its sizes and colours. Customers see the name, MRP, pictures and whether it's in stock; never costs or
            your selling price.
          </span>
        </span>
      </label>
      {!item.mrp && <Alert kind="warning">This variant has no MRP, so the website can't show a price for it.</Alert>}
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Try on" hint="Customers place it on their wall or ceiling with the camera. Needs a cut-out picture.">
          <Select value={form.tryon_surface} onChange={(e) => setForm({ ...form, tryon_surface: e.target.value })}>
            {TRY_ON.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Show in New in store">
          <Select value={form.web_new} onChange={(e) => setForm({ ...form, web_new: e.target.value })}>
            {NEW_IN_STORE.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Website description" hint="Public: a line or two for customers. No internal notes.">
        <textarea
          rows={2}
          maxLength={600}
          value={form.web_description}
          onChange={(e) => setForm({ ...form, web_description: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={save} disabled={!dirty}>
          Save website settings
        </Button>
        {saved && !dirty && <span className="text-green-700 font-semibold">{saved}</span>}
      </div>
      <Alert onClose={() => setError("")}>{error}</Alert>

      <div className="flex flex-wrap gap-5 pt-2 border-t border-gray-100">
        <Picture item={item} kind="photo" label="Photo" hint={`Of this variant (${item.variant || item.name}). Shrunk before sending.`} has={web.photo} onChanged={onChanged} />
        {form.tryon_surface && (
          <Picture
            item={item}
            kind="tryon"
            label="Cut-out for try-on"
            hint="Front view with a see-through background (PNG). Free apps can remove the background."
            has={web.tryon}
            onChanged={onChanged}
          />
        )}
      </div>
    </Section>
  );
}
