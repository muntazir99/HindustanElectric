import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { useFetch } from "../../hooks/useFetch.js";
import { money } from "../../lib/format.js";
import { Alert, Button, Spinner } from "../../ui/index.js";

/** Payment receipt for money received against khata (half an A4 sheet). */
export default function ReceiptPrint() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data: receipt, error } = useFetch(`/sales/receipts/${id}`);
  const { data: shop } = useFetch("/shop/settings");

  useEffect(() => {
    if (!receipt || !shop || params.get("auto") !== "1") return undefined;
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, [receipt, shop, params]);

  if (error) return <Alert>{error}</Alert>;
  if (!receipt || !shop) return <Spinner />;
  const s = shop.data;
  const balance = Number(receipt.balance_after);

  return (
    <div className="bg-gray-200 min-h-screen py-6 print:bg-white print:py-0">
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex gap-3 px-2">
        <Button to={`/customers/${receipt.customer}`}>
          <ArrowLeft size={18} /> Back to khata
        </Button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer size={18} /> Print
        </Button>
      </div>
      <article className="bg-white max-w-[210mm] mx-auto p-[8mm] text-[12px] text-black shadow print:shadow-none print:p-0">
        <div className="border border-black p-4">
          <div className="text-center border-b border-black pb-2 mb-3">
            <p className="text-xl font-bold uppercase">{s.name}</p>
            {s.address && <p className="whitespace-pre-line">{s.address}</p>}
            <p>{[s.phone && `Phone: ${s.phone}`, s.gstin && `GSTIN: ${s.gstin}`].filter(Boolean).join("   ")}</p>
          </div>
          <p className="text-center font-bold text-base mb-3">PAYMENT RECEIPT</p>
          {receipt.cancelled_at && (
            <p className="text-center text-red-700 font-bold text-lg border-2 border-red-600 mb-3 py-1">
              CANCELLED — {receipt.cancel_reason}
            </p>
          )}
          <div className="flex justify-between mb-3">
            <span>
              Receipt no. <b>{receipt.receipt_number}</b>
            </span>
            <span>
              Date <b>{new Date(receipt.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}</b>
            </span>
          </div>
          <p className="mb-2">
            Received with thanks from <b>{receipt.customer_detail?.name}</b>
            {receipt.customer_detail?.phone && ` (${receipt.customer_detail.phone})`} the sum of{" "}
            <b>{money(receipt.amount)}</b>
          </p>
          <p className="mb-2 italic">{receipt.amount_in_words}</p>
          <p className="mb-2">
            by <b>{receipt.mode_display}</b>
            {receipt.reference && `, ref. ${receipt.reference}`} against their account.
          </p>
          {receipt.note && <p className="mb-2">Note: {receipt.note}</p>}
          <p className="mb-6">
            {balance > 0 ? (
              <>
                Balance still due: <b>{money(balance)}</b>
              </>
            ) : balance < 0 ? (
              <>
                Advance with us: <b>{money(-balance)}</b>
              </>
            ) : (
              <b>Account fully settled.</b>
            )}
          </p>
          <div className="flex justify-between items-end">
            <span>Received by: {receipt.created_by}</span>
            <span className="text-right">
              For {s.name}
              <br />
              <br />
              Authorised signatory
            </span>
          </div>
        </div>
      </article>
    </div>
  );
}
