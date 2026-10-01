import { useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { useFetch } from "../../hooks/useFetch.js";
import { money, plain } from "../../lib/format.js";
import { Alert, Button, Spinner } from "../../ui/index.js";

const day = (value) => new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

/** A4 credit note for goods returned against a bill. */
export default function CreditNotePrint() {
  const { id } = useParams();
  const { data: note, error } = useFetch(`/sales/credit-notes/${id}`);
  const { data: shop } = useFetch("/shop/settings");

  if (error) return <Alert>{error}</Alert>;
  if (!note || !shop) return <Spinner />;
  const s = shop.data;
  const sameState = Number(note.igst_total) === 0;

  return (
    <div className="bg-gray-200 min-h-screen py-6 print:bg-white print:py-0">
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex gap-3 px-2">
        <Button to={`/bills/${note.invoice}`}>
          <ArrowLeft size={18} /> Back to bill
        </Button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer size={18} /> Print
        </Button>
      </div>
      <article className="bg-white max-w-[210mm] mx-auto p-[8mm] text-[11px] leading-snug text-black shadow print:shadow-none print:p-0">
        <div className="border border-black">
          <div className="flex justify-between px-2 py-1 border-b border-black">
            <span>GSTIN: <b>{s.gstin || "—"}</b></span>
            <span className="font-bold">CREDIT NOTE</span>
            <span>Original for Recipient</span>
          </div>
          <div className="text-center py-2 border-b border-black">
            <p className="text-xl font-bold uppercase tracking-wide">{s.name}</p>
            {s.address && <p className="whitespace-pre-line">{s.address}</p>}
            <p>{[s.phone && `Phone: ${s.phone}`, s.email && `Email: ${s.email}`].filter(Boolean).join("   ")}</p>
          </div>
          <div className="grid grid-cols-2 border-b border-black">
            <div className="p-2 border-r border-black">
              <p className="font-bold mb-1">Issued to</p>
              <p className="font-semibold">{note.buyer_name || "Cash sale"}</p>
              {note.buyer_address && <p className="whitespace-pre-line">{note.buyer_address}</p>}
              {note.buyer_phone && <p>Phone: {note.buyer_phone}</p>}
              {note.buyer_gstin && <p>GSTIN: <b>{note.buyer_gstin}</b></p>}
            </div>
            <div className="p-2 grid grid-cols-[auto_1fr] gap-x-3 content-start">
              <span>Credit note no.</span><b>{note.number}</b>
              <span>Date</span><b>{day(note.date)}</b>
              <span>Against invoice</span><b>{note.invoice_number} dated {day(note.invoice_date)}</b>
              <span>Place of supply</span><b>{note.place_of_supply_label}</b>
            </div>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="px-1 py-1 text-left w-6">#</th>
                <th className="px-1 py-1 text-left">Description of goods returned</th>
                <th className="px-1 py-1 text-left">HSN</th>
                <th className="px-1 py-1 text-right">Qty</th>
                <th className="px-1 py-1 text-right">Taxable</th>
                <th className="px-1 py-1 text-right">GST</th>
                <th className="px-1 py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {note.lines.map((line, index) => (
                <tr key={line.id} className="border-b border-gray-300">
                  <td className="px-1 py-0.5">{index + 1}</td>
                  <td className="px-1 py-0.5">{line.description}</td>
                  <td className="px-1 py-0.5">{line.hsn_code}</td>
                  <td className="px-1 py-0.5 text-right">{plain(line.quantity)} {line.unit_name}</td>
                  <td className="px-1 py-0.5 text-right">{Number(line.taxable_value).toFixed(2)}</td>
                  <td className="px-1 py-0.5 text-right">{plain(line.gst_rate)}%</td>
                  <td className="px-1 py-0.5 text-right">{Number(line.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-[1fr_auto] border-t border-black">
            <div className="p-2 border-r border-black">
              <table className="w-full mb-2">
                <thead>
                  <tr className="border-b border-gray-400">
                    <th className="text-left font-semibold">GST rate</th>
                    <th className="text-right font-semibold">Taxable</th>
                    {sameState ? (
                      <>
                        <th className="text-right font-semibold">CGST</th>
                        <th className="text-right font-semibold">SGST</th>
                      </>
                    ) : (
                      <th className="text-right font-semibold">IGST</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {note.tax_summary.map((row) => (
                    <tr key={row.rate}>
                      <td>{plain(row.rate)}%</td>
                      <td className="text-right">{Number(row.taxable).toFixed(2)}</td>
                      {sameState ? (
                        <>
                          <td className="text-right">{Number(row.cgst).toFixed(2)}</td>
                          <td className="text-right">{Number(row.sgst).toFixed(2)}</td>
                        </>
                      ) : (
                        <td className="text-right">{Number(row.igst).toFixed(2)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="font-semibold">{note.amount_in_words}</p>
              <p className="mt-1">Reason: {note.reason}</p>
              <p>Settled by: <b>{note.refund_mode_display}</b></p>
            </div>
            <dl className="p-2 min-w-[200px] space-y-0.5">
              <div className="flex justify-between gap-6"><dt>Taxable value</dt><dd>{Number(note.taxable_total).toFixed(2)}</dd></div>
              {sameState ? (
                <>
                  <div className="flex justify-between gap-6"><dt>CGST</dt><dd>{Number(note.cgst_total).toFixed(2)}</dd></div>
                  <div className="flex justify-between gap-6"><dt>SGST</dt><dd>{Number(note.sgst_total).toFixed(2)}</dd></div>
                </>
              ) : (
                <div className="flex justify-between gap-6"><dt>IGST</dt><dd>{Number(note.igst_total).toFixed(2)}</dd></div>
              )}
              <div className="flex justify-between gap-6"><dt>Round off</dt><dd>{Number(note.round_off).toFixed(2)}</dd></div>
              <div className="flex justify-between gap-6 border-t border-black pt-1 text-sm font-bold"><dt>Total</dt><dd>{money(note.total)}</dd></div>
            </dl>
          </div>
          <div className="flex justify-between px-2 py-6 border-t border-black">
            <span>Receiver's signature</span>
            <span>For {s.name} — Authorised signatory</span>
          </div>
        </div>
      </article>
    </div>
  );
}
