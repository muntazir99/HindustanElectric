import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { HandCoins, Pencil, Printer, Receipt } from "lucide-react";
import api from "../../api.js";
import CustomerForm, { CUSTOMER_KINDS } from "../../components/CustomerForm.js";
import { useAuth } from "../../context/AuthContext.js";
import { A } from "../../lib/access.js";
import { useFetch } from "../../hooks/useFetch.js";
import { usePage } from "../../hooks/usePage.js";
import { errorMessage } from "../../lib/errors.js";
import { bigMoney, date, money } from "../../lib/format.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  DonePanel,
  Field,
  GoHomeButton,
  Input,
  Modal,
  NumberInput,
  Spinner,
  Table,
  td,
  th,
} from "../../ui/index.js";
import { BalanceText } from "./CustomerList.js";

const KIND_LABEL = Object.fromEntries(CUSTOMER_KINDS);
// What each khata line means, in shop words. The printed statement uses the same words.
const LINE_LABEL = {
  opening: "Old udhaar from the register",
  bill: "Bill",
  payment: "Payment received",
  bill_cancelled: "Bill cancelled",
  refund: "Money given back",
  return: "Goods returned",
  receipt_cancelled: "Receipt cancelled",
  adjustment: "Correction",
};

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
    <Modal title={`Take payment from ${customer.name}`} onClose={onClose}>
      <Alert>{error}</Alert>
      <p className="mb-4">
        Udhaar now: <BalanceText balance={customer.balance} />
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
        <p className="font-semibold text-gray-700 -mb-2">Paid by</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Paid by">
          {MODES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`min-h-[44px] px-4 rounded-xl border-2 font-semibold ${mode === value ? "bg-blue-800 text-white border-blue-800" : "bg-white border-gray-300"}`}
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
        For a payment entered by mistake. The receipt ({money(line.credit)}) is marked cancelled and the udhaar goes back
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
  const { can } = useAuth();
  const [range, setRange] = useState({ from: "", to: "" });
  const query = new URLSearchParams();
  if (range.from) query.set("date_from", range.from);
  if (range.to) query.set("date_to", range.to);
  const { data, error, loading, reload } = useFetch(`/sales/customers/${id}/ledger?${query}`);
  const { data: bills } = useFetch(can(A.VIEW_BILLS) ? `/sales/invoices?status=all&customer=${id}&page_size=20` : null);
  const { data: shop } = useFetch("/shop/settings");
  const [params, setParams] = useSearchParams();
  // "Take payment" on Home opens the customer with the payment box already open (once, not on every refresh).
  const [modal, setModal] = useState(params.get("pay") === "1" && can(A.PAYMENTS) ? "payment" : null);
  useEffect(() => {
    if (params.has("pay")) setParams({}, { replace: true });
  }, [params, setParams]);
  const [receipt, setReceipt] = useState(null);

  usePage(data?.customer?.name || "Customer", ["/customers", "Khata"]);

  if (loading && !data) return <Spinner />;
  if (!data) return <Alert>{error || "Customer not found."}</Alert>;
  const customer = data.customer;
  const hasOpening = data.lines.some((line) => line.kind === "opening") || (range.from && Number(data.brought_forward) !== 0);

  // Just took a payment: say so, with what's still due, and what to do next.
  if (receipt) {
    const due = Number(customer.balance);
    return (
      <DonePanel
        title="Payment saved"
        detail={`${money(receipt.amount)} from ${customer.name} · Receipt ${receipt.receipt_number}`}
        note={
          due > 0
            ? `${customer.name} still owes ${money(due)}.`
            : due < 0
              ? `${customer.name} now has ${money(-due)} advance.`
              : "Nothing due now — the khata is clear."
        }
      >
        <GoHomeButton />
        <Button className="h-14 text-lg" to={`/receipts/${receipt.id}/print`}>
          <Printer size={20} /> Print receipt
        </Button>
        <button type="button" onClick={() => setReceipt(null)} className="self-center p-2 font-semibold text-blue-800 hover:underline">
          See {customer.name}'s khata
        </button>
      </DonePanel>
    );
  }

  async function post(action, body) {
    await api.post(`/sales/customers/${customer.id}/${action}`, body);
    setModal(null);
    reload();
  }

  return (
    <>
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

      <Card className="no-print p-5 md:p-6 mt-2 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold leading-tight flex flex-wrap items-center gap-3">
              {customer.name} <Badge color="blue">{KIND_LABEL[customer.kind]}</Badge>
              {!customer.is_active && <Badge>Inactive</Badge>}
            </h1>
            <p className="text-gray-700 mt-1">
              {[customer.phone, customer.gstin && `GSTIN ${customer.gstin}`, customer.address].filter(Boolean).join(" · ") || "No contact details"}
            </p>
            <p className="text-gray-500">
              {customer.credit_limit === null ? "No udhaar limit" : `Udhaar limit ${money(customer.credit_limit)}`}
              {Number(customer.default_discount_percent) > 0 && ` · gets ${Number(customer.default_discount_percent)}% off every bill`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-600">{Number(customer.balance) > 0 ? "Owes" : Number(customer.balance) < 0 ? "Advance" : "Udhaar"}</p>
            <p
              className={`text-4xl font-bold leading-tight ${
                Number(customer.balance) > 0 ? "text-red-700" : Number(customer.balance) < 0 ? "text-green-700" : "text-gray-400"
              }`}
            >
              {Number(customer.balance) === 0 ? "Nothing due" : bigMoney(Math.abs(Number(customer.balance)))}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          {can(A.PAYMENTS) && (
            <Button variant="success" className="h-14 px-6 text-lg grow sm:grow-0" onClick={() => setModal("payment")}>
              <HandCoins size={22} /> Take Payment
            </Button>
          )}
          <Button className="h-14" onClick={() => window.print()}>
            <Printer size={20} /> Print khata
          </Button>
          {can(A.VIEW_KHATA, A.KHATA_CONTROL) && (
            <Button className="h-14" onClick={() => setModal("edit")}>
              <Pencil size={18} /> Edit details
            </Button>
          )}
        </div>
      </Card>

      {can(A.KHATA_CONTROL) && (
        <div className="no-print flex flex-wrap items-center gap-3 mb-5 px-1">
          <span className="text-gray-600">Corrections:</span>
          {!hasOpening && <Button onClick={() => setModal("opening")}>Add old udhaar from the register</Button>}
          <Button onClick={() => setModal("adjust")}>Correct the khata</Button>
          <span className="text-sm text-gray-500">Every change is recorded with a reason.</span>
        </div>
      )}

      <Card className="mb-6">
        <div className="no-print flex flex-wrap items-center gap-3 px-5 py-4 border-b">
          <h2 className="font-bold text-xl mr-auto">History</h2>
          <label className="flex items-center gap-2">
            From <input type="date" className="border border-gray-300 rounded-xl px-2 py-1.5" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </label>
          <label className="flex items-center gap-2">
            To <input type="date" className="border border-gray-300 rounded-xl px-2 py-1.5" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </label>
          {(range.from || range.to) && (
            <button type="button" className="text-blue-800 underline" onClick={() => setRange({ from: "", to: "" })}>
              Show everything
            </button>
          )}
        </div>
        <Table>
          <thead>
            <tr>
              <th className={th}>Date</th>
              <th className={th}>What happened</th>
              {/* On screen it's the shop's view (Khatabook style); the printout goes to the customer. */}
              <th className={`${th} text-right`}>
                <span className="print:hidden">You gave</span>
                <span className="hidden print:inline">Bill amount</span>
              </th>
              <th className={`${th} text-right`}>
                <span className="print:hidden">You got</span>
                <span className="hidden print:inline">Paid</span>
              </th>
              <th className={`${th} text-right`}>
                <span className="print:hidden">Owes</span>
                <span className="hidden print:inline">Balance</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {range.from && (
              <tr>
                <td className={td} />
                <td className={`${td} italic`}>Owed before {date(range.from)}</td>
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
                  <span className="font-semibold">{LINE_LABEL[line.kind] || line.kind_display}</span>
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
                  {line.kind === "payment" && line.receipt_number && !line.receipt_cancelled && can(A.RETURNS) && (
                    <button type="button" onClick={() => setModal({ cancelReceipt: line })} className="no-print ml-3 text-sm text-red-700 hover:underline">
                      cancel receipt
                    </button>
                  )}
                  {line.note && !line.note.startsWith("Bill ") && !line.note.startsWith("Receipt ") && (
                    <div className="text-sm text-gray-600">{line.note}</div>
                  )}
                </td>
                <td className={`${td} text-right text-red-700`}>{Number(line.debit) ? money(line.debit) : ""}</td>
                <td className={`${td} text-right text-green-700`}>{Number(line.credit) ? money(line.credit) : ""}</td>
                <td className={`${td} text-right font-semibold`}>{money(line.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className={td} colSpan={4}>
                <b className="print:hidden">Owes now</b>
                <b className="hidden print:inline">Balance due</b>
              </td>
              <td className={`${td} text-right font-bold`}>{money(data.closing_balance)}</td>
            </tr>
          </tfoot>
        </Table>
      </Card>

      {bills && bills.results.length > 0 && (
        <Card className="no-print">
          <h2 className="font-bold text-xl px-5 py-4 border-b">Recent bills</h2>
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
                  <td className={`${td} text-right text-red-700`}>{Number(bill.credit_amount) ? `${money(bill.credit_amount)} on udhaar` : ""}</td>
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
          onDone={async (payment) => {
            await reload(); // so the done screen shows what's still owed after this payment
            setModal(null);
            setReceipt(payment);
          }}
        />
      )}
      {modal === "opening" && (
        <AmountModal
          title="Old udhaar from the register"
          help="What this customer already owed in the paper khata when you started using the app. Can be added once; use “Correct the khata” to change it later."
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
          title="Correct the khata"
          help="For mistakes only — bills and payments update the khata by themselves."
          needsNote
          onClose={() => setModal(null)}
          onSubmit={(body) => post("adjust", body)}
        />
      )}
    </>
  );
}
