import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, FileOutput, Printer, Undo2 } from "lucide-react";
import api from "../../api.js";
import { useAuth } from "../../context/AuthContext.js";
import { useFetch } from "../../hooks/useFetch.js";
import { errorMessage } from "../../lib/errors.js";
import { date, dateTime, money, plain } from "../../lib/format.js";
import { Alert, Badge, Button, Card, Field, Input, Modal, NumberInput, Spinner, Table, td, th } from "../../ui/index.js";
import { BILL_STATUS } from "./BillList.js";

function CancelModal({ bill, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    try {
      onDone((await api.post(`/sales/invoices/${bill.id}/cancel`, { reason })).data);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Cancel bill ${bill.number}?`} onClose={onClose}>
      <Alert>{error}</Alert>
      <p className="mb-3">
        The goods go back into stock, payments are recorded as refunded ({money(bill.paid_amount)}), and any khata amount
        is reversed. The bill number stays, marked <b>Cancelled</b>.
      </p>
      <Field label="Reason *">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="e.g. customer changed mind" />
      </Field>
      <div className="flex gap-3 mt-5">
        <Button variant="danger" onClick={cancel} disabled={busy || !reason.trim()}>
          {busy ? "Cancelling…" : "Cancel bill"}
        </Button>
        <Button onClick={onClose}>Keep bill</Button>
      </div>
    </Modal>
  );
}

const REFUND_MODES = [
  ["cash", "Cash back"],
  ["upi", "UPI back"],
  ["khata", "Credit to khata"],
];

function ReturnModal({ bill, onClose, onDone }) {
  const returnable = bill.lines
    .map((line) => ({ ...line, left: Number(line.quantity) - Number(line.returned_quantity) }))
    .filter((line) => line.left > 0);
  const [quantities, setQuantities] = useState({});
  const [refundMode, setRefundMode] = useState("cash");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = returnable.filter((line) => Number(quantities[line.id]) > 0);
  const tooMany = chosen.find((line) => Number(quantities[line.id]) > line.left);
  const estimate = chosen.reduce((sum, line) => sum + (Number(line.total) * Number(quantities[line.id])) / Number(line.quantity), 0);

  async function save() {
    setBusy(true);
    try {
      const response = await api.post(`/sales/invoices/${bill.id}/returns`, {
        lines: chosen.map((line) => ({ line: line.id, quantity: quantities[line.id] })),
        refund_mode: refundMode,
        reason,
      });
      onDone(response.data);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Return goods from bill ${bill.number}`} onClose={onClose} wide>
      <Alert>{error}</Alert>
      {returnable.length === 0 ? (
        <p>Everything on this bill has already been returned.</p>
      ) : (
        <>
          <table className="w-full text-left mb-4">
            <thead>
              <tr className="text-xs uppercase text-gray-500 border-b">
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Sold</th>
                <th className="py-2 text-right">Can return</th>
                <th className="py-2 text-right w-36">Returning</th>
              </tr>
            </thead>
            <tbody>
              {returnable.map((line) => (
                <tr key={line.id} className="border-b border-gray-100">
                  <td className="py-2">{line.description}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {plain(line.quantity)} {line.unit_name}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {plain(line.left)} {line.unit_name}
                  </td>
                  <td className="py-2">
                    <NumberInput
                      className="text-right py-1"
                      value={quantities[line.id] || ""}
                      aria-label={`Returning ${line.description}`}
                      onChange={(e) => setQuantities({ ...quantities, [line.id]: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2 mb-4" role="radiogroup" aria-label="Money back as">
            {REFUND_MODES.filter(([value]) => value !== "khata" || bill.customer).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={refundMode === value}
                onClick={() => setRefundMode(value)}
                className={`px-3 py-1.5 rounded-lg border font-semibold ${refundMode === value ? "bg-blue-700 text-white border-blue-700" : "bg-white border-gray-300"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Field label="Reason *">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. unused material returned by electrician" />
          </Field>
          {tooMany && <p className="text-red-700 text-sm mt-2">{tooMany.description}: more than can be returned.</p>}
          {chosen.length > 0 && !tooMany && (
            <p className="mt-3">
              About <b>{money(estimate)}</b> {refundMode === "khata" ? "will be credited to the khata" : "to give back"} (exact amount on the credit note).
            </p>
          )}
          <div className="flex gap-3 mt-5">
            <Button variant="primary" onClick={save} disabled={busy || !chosen.length || Boolean(tooMany) || !reason.trim()}>
              {busy ? "Saving…" : "Make credit note"}
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function BillDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: bill, error, loading, setData, reload } = useFetch(`/sales/invoices/${id}`);
  const [cancelling, setCancelling] = useState(false);
  const [returning, setReturning] = useState(false);
  const [actionError, setActionError] = useState("");

  if (loading && !bill) return <Spinner />;
  if (!bill) return <Alert>{error || "Bill not found."}</Alert>;
  const quotation = bill.kind === "quotation";
  const [color, label] = quotation ? ["blue", "Quotation"] : BILL_STATUS[bill.status];
  const isOwner = user?.role === "owner";

  async function convert() {
    setActionError("");
    try {
      const response = await api.post(`/sales/invoices/${bill.id}/convert`);
      navigate(`/billing?resume=${response.data.id}`);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <>
      <Link to="/bills" className="inline-flex items-center gap-1 text-blue-800 mb-3 hover:underline">
        <ArrowLeft size={16} /> Bills
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {quotation ? "Quotation" : "Bill"} {bill.number} <Badge color={color}>{label}</Badge>
          </h1>
          <p className="text-gray-600 mt-1">
            {quotation ? `${date(bill.invoice_date)}, valid until ${date(bill.valid_until)}` : `${dateTime(bill.finalised_at)} by ${bill.finalised_by}`}
            {" · "}
            {bill.buyer_name || (quotation ? "No name" : "Cash sale")}
            {bill.buyer_phone && ` · ${bill.buyer_phone}`}
          </p>
          {quotation && bill.converted_to && (
            <p className="mt-1">
              Billed as{" "}
              <Link to={`/bills/${bill.converted_to}`} className="text-blue-800 underline">
                {bill.converted_to_number || "a bill in progress"}
              </Link>
            </p>
          )}
          {bill.status === "cancelled" && (
            <p className="text-red-700 mt-1">
              Cancelled {dateTime(bill.cancelled_at)} by {bill.cancelled_by}: {bill.cancel_reason}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="primary" to={`/bills/${bill.id}/print`}>
            <Printer size={18} /> Print
          </Button>
          {quotation && (
            <Button variant="success" onClick={convert}>
              <FileOutput size={18} /> Convert to bill
            </Button>
          )}
          {isOwner && bill.status === "final" && (
            <Button onClick={() => setReturning(true)}>
              <Undo2 size={18} /> Return goods
            </Button>
          )}
          {isOwner && bill.status === "final" && bill.credit_notes.length === 0 && (
            <Button variant="danger" onClick={() => setCancelling(true)}>
              <Ban size={18} /> Cancel bill
            </Button>
          )}
        </div>
      </div>

      <Alert>{actionError}</Alert>
      {bill.credit_notes.length > 0 && (
        <Alert kind="info">
          Returns:{" "}
          {bill.credit_notes.map((note, index) => (
            <span key={note.id}>
              {index > 0 && ", "}
              <Link to={`/credit-notes/${note.id}/print`} className="underline font-semibold">
                {note.number}
              </Link>{" "}
              ({money(note.total)})
            </span>
          ))}
        </Alert>
      )}
      <Card className="mb-6">
        <Table>
          <thead>
            <tr>
              <th className={th}>Item</th>
              <th className={`${th} text-right`}>Qty</th>
              <th className={`${th} text-right`}>Rate</th>
              <th className={`${th} text-right`}>Discount</th>
              <th className={`${th} text-right`}>GST</th>
              <th className={`${th} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((line) => (
              <tr key={line.id}>
                <td className={td}>
                  <Link to={`/items/${line.item}`} className="font-semibold hover:underline">
                    {line.description}
                  </Link>
                  <div className="text-xs text-gray-500">HSN {line.hsn_code || "—"}</div>
                </td>
                <td className={`${td} text-right whitespace-nowrap`}>
                  {plain(line.quantity)} {line.unit_name}
                  {Number(line.returned_quantity) > 0 && (
                    <div className="text-xs text-amber-800">{plain(line.returned_quantity)} returned</div>
                  )}
                </td>
                <td className={`${td} text-right`}>{money(line.rate)}</td>
                <td className={`${td} text-right`}>{Number(line.discount) ? money(line.discount) : "—"}</td>
                <td className={`${td} text-right`}>{plain(line.gst_rate)}%</td>
                <td className={`${td} text-right font-semibold`}>{money(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="font-bold mb-2">Payments</h2>
          {bill.payments.length === 0 ? (
            <p className="text-gray-500">None at the counter.</p>
          ) : (
            <ul className="space-y-1">
              {bill.payments.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>
                    {p.kind_display} · {p.mode_display}
                  </span>
                  <span className={p.kind === "refund" ? "text-red-700" : ""}>
                    {p.kind === "refund" ? "−" : ""}
                    {money(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {Number(bill.credit_amount) > 0 && (
            <p className="mt-3 font-semibold text-red-700">
              On khata: {money(bill.credit_amount)}
              {bill.customer && (
                <Link to={`/customers/${bill.customer}`} className="ml-2 text-blue-800 underline font-normal">
                  View khata
                </Link>
              )}
            </p>
          )}
        </Card>
        <Card className="p-5">
          <dl className="space-y-1">
            <div className="flex justify-between"><dt>Taxable value</dt><dd>{money(bill.taxable_total)}</dd></div>
            {Number(bill.igst_total) > 0 ? (
              <div className="flex justify-between"><dt>IGST</dt><dd>{money(bill.igst_total)}</dd></div>
            ) : (
              <div className="flex justify-between"><dt>CGST + SGST</dt><dd>{money(bill.cgst_total)} + {money(bill.sgst_total)}</dd></div>
            )}
            {Number(bill.discount_total) > 0 && <div className="flex justify-between"><dt>Discount given</dt><dd>{money(bill.discount_total)}</dd></div>}
            <div className="flex justify-between"><dt>Round off</dt><dd>{money(bill.round_off)}</dd></div>
            <div className="flex justify-between text-xl font-bold border-t pt-2"><dt>Total</dt><dd>{money(bill.total)}</dd></div>
            <p className="text-sm text-gray-600">{bill.amount_in_words}</p>
          </dl>
        </Card>
      </div>

      {returning && (
        <ReturnModal
          bill={bill}
          onClose={() => setReturning(false)}
          onDone={(note) => {
            setReturning(false);
            reload();
            navigate(`/credit-notes/${note.id}/print`);
          }}
        />
      )}
      {cancelling && (
        <CancelModal
          bill={bill}
          onClose={() => setCancelling(false)}
          onDone={(updated) => {
            setData(updated);
            setCancelling(false);
          }}
        />
      )}
    </>
  );
}
