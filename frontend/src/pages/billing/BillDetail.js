import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Printer } from "lucide-react";
import api from "../../api.js";
import { useAuth } from "../../context/AuthContext.js";
import { useFetch } from "../../hooks/useFetch.js";
import { errorMessage } from "../../lib/errors.js";
import { dateTime, money, plain } from "../../lib/format.js";
import { Alert, Badge, Button, Card, Field, Input, Modal, Spinner, Table, td, th } from "../../ui/index.js";
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

export default function BillDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: bill, error, loading, setData } = useFetch(`/sales/invoices/${id}`);
  const [cancelling, setCancelling] = useState(false);

  if (loading && !bill) return <Spinner />;
  if (!bill) return <Alert>{error || "Bill not found."}</Alert>;
  const [color, label] = BILL_STATUS[bill.status];

  return (
    <>
      <Link to="/bills" className="inline-flex items-center gap-1 text-blue-800 mb-3 hover:underline">
        <ArrowLeft size={16} /> Bills
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Bill {bill.number} <Badge color={color}>{label}</Badge>
          </h1>
          <p className="text-gray-600 mt-1">
            {dateTime(bill.finalised_at)} by {bill.finalised_by} · {bill.buyer_name || "Cash sale"}
            {bill.buyer_phone && ` · ${bill.buyer_phone}`}
          </p>
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
          {user?.role === "owner" && bill.status === "final" && (
            <Button variant="danger" onClick={() => setCancelling(true)}>
              <Ban size={18} /> Cancel bill
            </Button>
          )}
        </div>
      </div>

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
