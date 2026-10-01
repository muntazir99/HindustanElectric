import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, HandCoins, Pencil, Printer, Receipt } from "lucide-react";
import api from "../../api.js";
import CustomerForm, { CUSTOMER_KINDS } from "../../components/CustomerForm.js";
import { useAuth } from "../../context/AuthContext.js";
import { useFetch } from "../../hooks/useFetch.js";
import { errorMessage } from "../../lib/errors.js";
import { date, money } from "../../lib/format.js";
import { Alert, Badge, Button, Card, Field, Input, Modal, NumberInput, Spinner, Table, td, th } from "../../ui/index.js";
import { BalanceText } from "./CustomerList.js";

const KIND_LABEL = Object.fromEntries(CUSTOMER_KINDS);
const MODES = [
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["card", "Card"],
  ["bank", "Bank"],
  ["cheque", "Cheque"],
];

function PaymentModal({ customer, onClose, onDone }) {
  const due = Number(customer.balance);
  const [amount, setAmount] = useState(due > 0 ? String(due) : "");
  const [mode, setMode] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmAdvance, setConfirmAdvance] = useState(false);
  const advance = Number(amount) - Math.max(due, 0);

  async function save() {
    if (advance > 0 && !confirmAdvance) {
      setConfirmAdvance(true);
      return;
    }
    setBusy(true);
    try {
      onDone((await api.post(`/sales/customers/${customer.id}/payments`, { amount, mode, reference, note })).data);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Payment from ${customer.name}`} onClose={onClose}>
      <Alert>{error}</Alert>
      <p className="mb-4">
        Khata now: <BalanceText balance={customer.balance} />
      </p>
      <div className="grid gap-4">
        <Field label="Amount received (₹)">
          <NumberInput
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setConfirmAdvance(false);
            }}
            onFocus={(e) => e.target.select()}
            autoFocus
          />
        </Field>
        {Number(amount) > 0 && <p className="text-sm text-gray-700 -mt-2">{money(amount)}</p>}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Paid by">
          {MODES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`px-3 py-1.5 rounded-lg border font-semibold ${mode === value ? "bg-blue-700 text-white border-blue-700" : "bg-white border-gray-300"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode !== "cash" && (
          <Field label="Reference" hint="UPI transaction ID, cheque number…">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        )}
        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {confirmAdvance && (
        <Alert kind="warning">
          This is {money(advance)} more than {customer.name} owes. It will be kept as an advance. Check the amount, then
          press the button again to confirm.
        </Alert>
      )}
      <div className="flex gap-3 mt-6">
        <Button variant="success" onClick={save} disabled={busy || !(Number(amount) > 0)}>
          {busy ? "Saving…" : confirmAdvance ? "Yes, keep the advance" : "Save & make receipt"}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

function CancelReceiptModal({ line, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function cancel() {
    try {
      await api.post(`/sales/receipts/${line.payment}/cancel`, { reason });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal title={`Cancel receipt ${line.receipt_number}?`} onClose={onClose}>
      <Alert>{error}</Alert>
      <p className="mb-4">
        For a payment entered by mistake. The receipt ({money(line.credit)}) is marked cancelled and the khata goes back
        up by the same amount. Nothing is deleted.
      </p>
      <Field label="Reason *">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
      <div className="flex gap-3 mt-5">
        <Button variant="danger" onClick={cancel} disabled={!reason.trim()}>
          Cancel receipt
        </Button>
        <Button onClick={onClose}>Keep it</Button>
      </div>
    </Modal>
  );
}

function AmountModal({ title, help, needsNote, onClose, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function save() {
    try {
      await onSubmit({ amount, note });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <Alert>{error}</Alert>
      <p className="text-sm text-gray-600 mb-4">{help}</p>
      <div className="grid gap-4">
        <Field label="Amount (₹)" hint="Positive = customer owes more; negative = owes less / advance">
          <NumberInput value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label={needsNote ? "Reason *" : "Note"}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-3 mt-6">
        <Button variant="primary" onClick={save} disabled={!Number(amount) || (needsNote && !note.trim())}>
          Save
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const [range, setRange] = useState({ from: "", to: "" });
  const query = new URLSearchParams();
  if (range.from) query.set("date_from", range.from);
  if (range.to) query.set("date_to", range.to);
  const { data, error, loading, reload } = useFetch(`/sales/customers/${id}/ledger?${query}`);
  const { data: bills } = useFetch(`/sales/invoices?status=all&customer=${id}&page_size=20`);
  const { data: shop } = useFetch("/shop/settings");
  const [params] = useSearchParams();
  // "Take payment" on Home opens the customer with the payment box already open.
  const [modal, setModal] = useState(params.get("pay") === "1" ? "payment" : null);
  const [receipt, setReceipt] = useState(null);

  if (loading && !data) return <Spinner />;
  if (!data) return <Alert>{error || "Customer not found."}</Alert>;
  const customer = data.customer;
  const hasOpening = data.lines.some((line) => line.kind === "opening") || (range.from && Number(data.brought_forward) !== 0);

  async function post(action, body) {
    await api.post(`/sales/customers/${customer.id}/${action}`, body);
    setModal(null);
    reload();
  }

  return (
    <>
      <Link to="/customers" className="no-print inline-flex items-center gap-1 text-blue-800 mb-3 hover:underline">
        <ArrowLeft size={16} /> Customers
      </Link>

      {/* Printed statement header */}
      <div className="hidden print:block mb-4">
        <p className="text-xl font-bold">{shop?.data.name}</p>
        <p>{shop?.data.address}</p>
        <p className="mt-3 text-lg font-bold">
          Khata statement — {customer.name} {customer.phone && `(${customer.phone})`}
        </p>
        <p>
          {range.from || range.to ? `${range.from ? date(range.from) : "start"} to ${range.to ? date(range.to) : "today"}` : `As on ${date(new Date())}`}
        </p>
      </div>

      <div className="no-print flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {customer.name} <Badge color="blue">{KIND_LABEL[customer.kind]}</Badge>
            {!customer.is_active && <Badge>Inactive</Badge>}
          </h1>
          <p className="text-gray-600 mt-1">
            {[customer.phone, customer.gstin && `GSTIN ${customer.gstin}`, customer.address].filter(Boolean).join(" · ") || "No contact details"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Credit limit: {customer.credit_limit === null ? "no limit" : money(customer.credit_limit)}
            {Number(customer.default_discount_percent) > 0 && ` · ${Number(customer.default_discount_percent)}% discount on every bill`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModal("edit")}>
            <Pencil size={18} /> Edit
          </Button>
          <Button onClick={() => window.print()}>
            <Printer size={18} /> Print statement
          </Button>
          <Button variant="success" onClick={() => setModal("payment")}>
            <HandCoins size={18} /> Receive payment
          </Button>
        </div>
      </div>

      <Alert kind="success" onClose={() => setReceipt(null)}>
        {receipt && (
          <>
            Received {money(receipt.amount)} · receipt <b>{receipt.receipt_number}</b>.{" "}
            <Link to={`/receipts/${receipt.id}/print`} className="underline font-semibold">
              Print receipt
            </Link>
          </>
        )}
      </Alert>

      <div className="grid md:grid-cols-3 gap-6 mb-6 no-print">
        <Card className="p-5">
          <p className="text-sm font-semibold text-gray-500">Khata balance</p>
          <p className="text-3xl font-bold mt-1">
            <BalanceText balance={customer.balance} />
          </p>
        </Card>
        {isOwner && (
          <Card className="p-5 md:col-span-2 flex flex-wrap items-center gap-3">
            {!hasOpening && (
              <Button onClick={() => setModal("opening")}>Set opening balance (from paper khata)</Button>
            )}
            <Button onClick={() => setModal("adjust")}>Adjust khata</Button>
            <p className="text-sm text-gray-500 w-full">Owner only. Every change is recorded with a reason.</p>
          </Card>
        )}
      </div>

      <Card className="mb-6">
        <div className="no-print flex flex-wrap items-center gap-3 px-5 py-4 border-b">
          <h2 className="font-bold text-lg mr-auto">Statement</h2>
          <label className="text-sm flex items-center gap-2">
            From <input type="date" className="border rounded-lg px-2 py-1" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </label>
          <label className="text-sm flex items-center gap-2">
            To <input type="date" className="border rounded-lg px-2 py-1" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </label>
          {(range.from || range.to) && (
            <button type="button" className="text-sm text-blue-800 underline" onClick={() => setRange({ from: "", to: "" })}>
              whole khata
            </button>
          )}
        </div>
        <Table>
          <thead>
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Particulars</th>
              <th className={`${th} text-right`}>Bill / owes</th>
              <th className={`${th} text-right`}>Paid</th>
              <th className={`${th} text-right`}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {range.from && (
              <tr>
                <td className={td} />
                <td className={`${td} italic`}>Brought forward</td>
                <td className={td} />
                <td className={td} />
                <td className={`${td} text-right font-semibold`}>{money(data.brought_forward)}</td>
              </tr>
            )}
            {data.lines.length === 0 && (
              <tr>
                <td colSpan={5} className={`${td} text-center text-gray-500 py-8`}>
                  No entries.
                </td>
              </tr>
            )}
            {data.lines.map((line) => (
              <tr key={line.id}>
                <td className={`${td} whitespace-nowrap`}>{date(line.date)}</td>
                <td className={td}>
                  <span className="font-semibold">{line.kind_display}</span>
                  {line.invoice && (
                    <Link to={`/bills/${line.invoice}`} className="ml-2 text-blue-800 hover:underline font-mono text-sm">
                      {line.invoice_number}
                    </Link>
                  )}
                  {line.receipt_number && (
                    <Link
                      to={`/receipts/${line.payment}/print`}
                      className={`ml-2 text-blue-800 hover:underline font-mono text-sm ${line.receipt_cancelled ? "line-through" : ""}`}
                    >
                      <Receipt size={14} className="inline mr-0.5" />
                      {line.receipt_number}
                    </Link>
                  )}
                  {line.kind === "payment" && line.receipt_number && !line.receipt_cancelled && isOwner && (
                    <button type="button" onClick={() => setModal({ cancelReceipt: line })} className="no-print ml-3 text-sm text-red-700 hover:underline">
                      cancel receipt
                    </button>
                  )}
                  {line.note && !line.note.startsWith("Bill ") && !line.note.startsWith("Receipt ") && (
                    <div className="text-sm text-gray-600">{line.note}</div>
                  )}
                </td>
                <td className={`${td} text-right`}>{Number(line.debit) ? money(line.debit) : ""}</td>
                <td className={`${td} text-right text-green-800`}>{Number(line.credit) ? money(line.credit) : ""}</td>
                <td className={`${td} text-right font-semibold`}>{money(line.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className={td} colSpan={4}>
                <b>Closing balance</b>
              </td>
              <td className={`${td} text-right font-bold`}>{money(data.closing_balance)}</td>
            </tr>
          </tfoot>
        </Table>
      </Card>

      {bills && bills.results.length > 0 && (
        <Card className="no-print">
          <h2 className="font-bold text-lg px-5 py-4 border-b">Recent bills</h2>
          <Table>
            <tbody>
              {bills.results.map((bill) => (
                <tr key={bill.id}>
                  <td className={`${td} font-mono text-sm`}>
                    <Link to={`/bills/${bill.id}`} className="text-blue-800 hover:underline">
                      {bill.number}
                    </Link>
                  </td>
                  <td className={td}>{date(bill.invoice_date)}</td>
                  <td className={`${td} text-right`}>{money(bill.total)}</td>
                  <td className={`${td} text-right text-red-700`}>{Number(bill.credit_amount) ? `${money(bill.credit_amount)} on khata` : ""}</td>
                  <td className={td}>{bill.status === "cancelled" && <Badge color="red">Cancelled</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {modal === "edit" && (
        <CustomerForm
          customer={customer}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal === "payment" && (
        <PaymentModal
          customer={customer}
          onClose={() => setModal(null)}
          onDone={(payment) => {
            setModal(null);
            setReceipt(payment);
            reload();
          }}
        />
      )}
      {modal === "opening" && (
        <AmountModal
          title="Opening balance"
          help="What this customer already owed in the paper khata when you started using the app. Can be set once; use Adjust khata to correct it later."
          onClose={() => setModal(null)}
          onSubmit={(body) => post("opening", body)}
        />
      )}
      {modal?.cancelReceipt && (
        <CancelReceiptModal
          line={modal.cancelReceipt}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal === "adjust" && (
        <AmountModal
          title="Adjust khata"
          help="For corrections only — bills and payments update the khata by themselves."
          needsNote
          onClose={() => setModal(null)}
          onSubmit={(body) => post("adjust", body)}
        />
      )}
    </>
  );
}
