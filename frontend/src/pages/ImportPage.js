import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import api from "../api.js";
import { SAMPLE_SHEET_NAME, SAMPLE_SHEET_URL, downloadFile } from "../lib/download.js";
import { errorMessage } from "../lib/errors.js";
import { Alert, Badge, Button, Card, PageHeader, Table, td, th } from "../ui/index.js";

const KINDS = {
  catalogue: {
    label: "Items (catalogue)",
    text: "Add new items or update existing ones: names, sizes, units, packs, barcodes, prices, racks. Fill the green Stock columns with what's on the shelf: they go into a stock count for you to review and post.",
  },
  prices: {
    label: "Price update",
    text: "Change MRP and selling prices from a distributor's new price list. Match by barcode (unit or pack) or item code.",
  },
};

const STATUS = {
  created: ["green", "New"],
  updated: ["blue", "Update"],
  unchanged: ["gray", "No change"],
  error: ["red", "Error"],
};

export default function ImportPage() {
  const [kind, setKind] = useState("catalogue");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [skipErrors, setSkipErrors] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function reset(nextKind = kind) {
    setKind(nextKind);
    setFile(null);
    setResult(null);
    setError("");
    setSkipErrors(false);
  }

  async function download(url, filename) {
    try {
      await downloadFile(url, filename);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function send(commit) {
    if (!file) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("commit", commit ? "true" : "false");
    form.append("skip_errors", skipErrors ? "true" : "false");
    try {
      const response = await api.post(`/import/${kind}`, form);
      setResult(response.data);
    } catch (err) {
      setError(errorMessage(err));
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  const summary = result?.summary;
  const rows = (result?.rows || []).filter((row) => !errorsOnly || row.status === "error");
  const good = summary ? summary.created + summary.updated : 0;

  return (
    <>
      <PageHeader title="Import from Excel" subtitle="Load many items or prices at once. You'll see a preview before anything is saved." />

      <div className="flex gap-2 mb-4" role="tablist">
        {Object.entries(KINDS).map(([value, { label }]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            onClick={() => reset(value)}
            className={`px-4 py-2 rounded-lg font-semibold border ${kind === value ? "bg-blue-700 text-white border-blue-700" : "bg-white border-gray-300"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="p-6 mb-6">
        <p className="text-gray-700 mb-4">{KINDS[kind].text}</p>
        <ol className="space-y-4">
          <li className="flex flex-wrap items-center gap-3">
            <span className="font-bold">1.</span>
            <Button onClick={() => download(`/import/${kind}/template`, `hindustan-electric-${kind}-template.xlsx`)}>
              <Download size={18} /> Download the Excel template
            </Button>
            {kind === "catalogue" && (
              <Button onClick={() => download(SAMPLE_SHEET_URL, SAMPLE_SHEET_NAME)}>
                <FileSpreadsheet size={18} /> Download a filled sample
              </Button>
            )}
            <span className="text-sm text-gray-600">The second sheet explains every column.</span>
          </li>
          <li className="flex flex-wrap items-center gap-3">
            <span className="font-bold">2.</span>
            <input
              type="file"
              accept=".xlsx,.csv"
              aria-label="Filled sheet"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setResult(null);
              }}
            />
          </li>
          <li className="flex flex-wrap items-center gap-3">
            <span className="font-bold">3.</span>
            <Button variant="primary" onClick={() => send(false)} disabled={!file || busy}>
              <Upload size={18} /> {busy && !summary ? "Checking…" : "Check the file"}
            </Button>
            <span className="text-sm text-gray-600">Nothing is saved yet.</span>
          </li>
        </ol>
      </Card>

      <Alert>{error}</Alert>

      {summary && (
        <Card className="mb-6">
          <div className="p-5 border-b">
            {summary.committed ? (
              <Alert kind="success">
                Imported: {summary.created} new, {summary.updated} updated
                {summary.errors ? `, ${summary.errors} rows skipped because of errors` : ""}.{" "}
                <Link to="/items?ordering=updated" className="underline font-semibold">
                  See items
                </Link>
                {summary.stock_count_id && (
                  <p className="mt-2">
                    Stock for {summary.stock_lines} item{summary.stock_lines === 1 ? "" : "s"} is waiting in the count{" "}
                    <b>{summary.stock_count_title}</b>.{" "}
                    <Link to={`/counts/${summary.stock_count_id}`} className="underline font-semibold">
                      Review and post it
                    </Link>{" "}
                    to put it into stock.
                  </p>
                )}
              </Alert>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-bold text-lg">Preview of {summary.rows} rows:</span>
                <Badge color="green">{summary.created} new</Badge>
                <Badge color="blue">{summary.updated} updates</Badge>
                {summary.unchanged > 0 && <Badge>{summary.unchanged} no change</Badge>}
                <Badge color={summary.errors ? "red" : "gray"}>{summary.errors} errors</Badge>
                {summary.stock_lines > 0 && (
                  <span className="text-sm text-gray-700">
                    Stock for {summary.stock_lines} item{summary.stock_lines === 1 ? "" : "s"} will go into a stock count for you to review.
                  </span>
                )}
              </div>
            )}
            {!summary.committed && (
              <div className="flex flex-wrap items-center gap-4 mt-4">
                {summary.errors > 0 && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={skipErrors} onChange={(e) => setSkipErrors(e.target.checked)} className="w-5 h-5" />
                    Skip the {summary.errors} rows with errors and import the rest
                  </label>
                )}
                <Button variant="success" onClick={() => send(true)} disabled={busy || good === 0 || (summary.errors > 0 && !skipErrors)}>
                  {busy ? "Importing…" : `Import ${good} rows`}
                </Button>
                {summary.errors > 0 && !skipErrors && (
                  <span className="text-sm text-gray-600">Fix the errors in Excel and check again, or tick “skip”.</span>
                )}
              </div>
            )}
          </div>
          <div className="px-5 py-3 border-b">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
              Show errors only
            </label>
          </div>
          <Table>
            <thead>
              <tr>
                <th className={th}>Row</th>
                <th className={th}>Result</th>
                <th className={th}>Item</th>
                <th className={th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.row} className={row.status === "error" ? "bg-red-50/50" : ""}>
                  <td className={`${td} text-gray-500`}>{row.row}</td>
                  <td className={td}>
                    <Badge color={STATUS[row.status][0]}>{STATUS[row.status][1]}</Badge>
                  </td>
                  <td className={td}>
                    {row.item}
                    {row.code && <span className="text-gray-500 text-sm"> #{row.code}</span>}
                  </td>
                  <td className={`${td} text-sm`}>{(row.messages || []).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
